package com.shatianrui.wereader.densitytest;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.ActivityOptions;
import android.content.Intent;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.FileInputStream;

/** Runs against the real release APK. No login, network mutation or private data. */
public class DensityProbe extends Instrumentation {
  private volatile Activity activity;
  private Activity originalActivity;
  private int displayId;
  public void onCreate(Bundle args) { super.onCreate(args); displayId=Integer.parseInt(args.getString("displayId","2")); start(); }
  public void callActivityOnResume(Activity a) { activity=a; super.callActivityOnResume(a); }
  private void shell(String cmd) throws Exception {
    try(ParcelFileDescriptor fd=getUiAutomation().executeShellCommand(cmd); FileInputStream in=new FileInputStream(fd.getFileDescriptor())) {
      byte[] b=new byte[1024]; while(in.read(b)!=-1) {} // Wait until shell mutation completes.
    }
  }
  private void textViews(View v, JSONArray labels) throws Exception {
    if(v.getVisibility()!=View.VISIBLE)return;
    if(v instanceof TextView) {
      TextView t=(TextView)v;
      if(t.getText().length()>0 && t.getLayout()!=null && t.getWidth()>0) {
        int lines=Math.min(t.getLayout().getLineCount(),t.getMaxLines());
        int needed=lines>0?t.getLayout().getLineBottom(lines-1)-t.getLayout().getLineTop(0):0;
        int available=t.getHeight()-t.getCompoundPaddingTop()-t.getCompoundPaddingBottom();
        JSONArray sizes=new JSONArray();
        if(t.getText() instanceof android.text.Spanned)for(android.text.style.AbsoluteSizeSpan span:((android.text.Spanned)t.getText()).getSpans(0,t.length(),android.text.style.AbsoluteSizeSpan.class))sizes.put(span.getSize());
        JSONObject row=new JSONObject().put("height",available).put("needed",needed).put("fontPx",t.getTextSize()).put("spanSizes",sizes).put("width",t.getWidth()).put("lines",lines).put("chars",t.getText().length());
        labels.put(row);
        if(available+2<needed)row.put("clipped",true);
      }
    }
    if(v instanceof ViewGroup) { ViewGroup g=(ViewGroup)v; for(int i=0;i<g.getChildCount();i++)textViews(g.getChildAt(i),labels); }
  }
  private JSONObject inspect(String stage) throws Exception {
    final JSONObject[] value={null}; final Throwable[] error={null};
    runOnMainSync(()->{try{
      Activity a=activity; if(a==null)throw new AssertionError("No resumed activity");
      if(a!=originalActivity)throw new AssertionError("Activity recreated during display transition");
      int expectedDisplay=stage.contains("phone")?0:displayId;
      if(a.getDisplay().getDisplayId()!=expectedDisplay)throw new AssertionError("Activity did not move to expected display "+expectedDisplay);
      DisplayMetrics local=a.getResources().getDisplayMetrics();
      DisplayMetrics appDisplay=new DisplayMetrics();
      ((android.view.WindowManager)a.getApplication().getSystemService(android.content.Context.WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(appDisplay);
      if(Math.abs(appDisplay.density-local.density)>.01)throw new AssertionError("Application WindowManager points at another display: "+appDisplay.density+" instead of "+local.density);
      Class<?> holder=getTargetContext().getClassLoader().loadClass("com.facebook.react.uimanager.DisplayMetricsHolder");
      DisplayMetrics global=(DisplayMetrics)holder.getMethod("getScreenDisplayMetrics").invoke(null);
      if(Math.abs(global.density-local.density)>.01||Math.abs(global.scaledDensity-local.scaledDensity)>.01)throw new AssertionError("Activity density="+local.density+", RN density="+global.density);
      Object host=a.getApplication().getClass().getMethod("getReactHost").invoke(a.getApplication());
      Object reactContext=host.getClass().getMethod("getCurrentReactContext").invoke(host);
      Object deviceInfo=reactContext.getClass().getMethod("getNativeModule",String.class).invoke(reactContext,"DeviceInfo");
      java.util.Map constants=(java.util.Map)deviceInfo.getClass().getMethod("getConstants").invoke(deviceInfo);
      java.util.Map dimensions=(java.util.Map)constants.get("Dimensions");
      java.util.Map jsWindow=(java.util.Map)dimensions.get("windowPhysicalPixels");
      if(Math.abs(((Number)jsWindow.get("scale")).doubleValue()-local.density)>.01)throw new AssertionError("JS Dimensions reports wrong display density: "+jsWindow);
      JSONArray labels=new JSONArray();
      // The Activity behind a modal is obscured; inspect the focused window,
      // then explicitly close the modal and inspect the Activity again below.
      try{for(View root:android.view.inspector.WindowInspector.getGlobalWindowViews())if(root.hasWindowFocus()){if(root.getDisplay().getDisplayId()!=expectedDisplay)throw new AssertionError("Focused window on wrong display");textViews(root,labels);}}catch(Throwable e){throw new AssertionError("activity="+local.density+", app="+getTargetContext().getResources().getDisplayMetrics().density+", RN="+global.density+": "+e);}
      if(labels.length()<5)throw new AssertionError("UI not rendered: "+labels.length()+" text views");
      value[0]=new JSONObject().put("stage",stage).put("displayId",a.getDisplay().getDisplayId()).put("density",local.density).put("rnDensity",global.density).put("fontScale",a.getResources().getConfiguration().fontScale).put("labels",labels);
    }catch(Throwable e){error[0]=e;}});
    if(error[0]!=null)throw new Exception(error[0]);return value[0];
  }
  private View findText(View v,String text) {
    if(v instanceof TextView && ((TextView)v).getText().toString().equals(text))return v;
    if(v instanceof ViewGroup)for(int i=0;i<((ViewGroup)v).getChildCount();i++){View found=findText(((ViewGroup)v).getChildAt(i),text);if(found!=null)return found;}
    return null;
  }
  private void openSettings() throws Exception {
    final int[] point=new int[2];final boolean[] found={false};
    runOnMainSync(()->{View v=findText(activity.getWindow().getDecorView(),"⋯");if(v!=null){v.getLocationOnScreen(point);point[0]+=v.getWidth()/2;point[1]+=v.getHeight()/2;found[0]=true;}});
    if(!found[0])throw new AssertionError("Settings button not found");
    shell("input -d "+displayId+" tap "+point[0]+" "+point[1]);Thread.sleep(3500);
    final boolean[] visible={false};runOnMainSync(()->{for(View root:android.view.inspector.WindowInspector.getGlobalWindowViews())if(findText(root,"阅读与听书设置")!=null)visible[0]=true;});
    if(!visible[0])throw new AssertionError("Settings modal did not open");
  }
  public void onStart() {
    Bundle output=new Bundle();JSONArray stages=new JSONArray();
    try {
      java.security.MessageDigest hash=java.security.MessageDigest.getInstance("SHA-256");
      try(FileInputStream apk=new FileInputStream(getTargetContext().getApplicationInfo().sourceDir)){byte[] buffer=new byte[65536];int count;while((count=apk.read(buffer))!=-1)hash.update(buffer,0,count);}
      StringBuilder hex=new StringBuilder();for(byte b:hash.digest())hex.append(String.format("%02x",b));output.putString("apkSha256",hex.toString());
      Intent intent=new Intent().setClassName("com.shatianrui.wereader","com.shatianrui.wereader.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ActivityOptions options=ActivityOptions.makeBasic();options.setLaunchDisplayId(displayId);
      activity=startActivitySync(intent,options.toBundle());
      originalActivity=activity;
      Thread.sleep(12000);stages.put(inspect("external-cold"));
      shell("wm density 240 -d "+displayId);Thread.sleep(3500);stages.put(inspect("external-density-240"));
      shell("am start --display 0 -n com.shatianrui.wereader/.MainActivity");Thread.sleep(3500);stages.put(inspect("move-to-phone"));
      shell("wm density reset -d "+displayId);
      shell("am start --display "+displayId+" -n com.shatianrui.wereader/.MainActivity");Thread.sleep(3500);stages.put(inspect("return-to-external"));
      openSettings();stages.put(inspect("settings-external"));
      shell("wm density 240 -d "+displayId);Thread.sleep(3500);stages.put(inspect("settings-density-240"));
      shell("am start --display 0 -n com.shatianrui.wereader/.MainActivity");Thread.sleep(3500);stages.put(inspect("settings-phone"));
      shell("wm density reset -d "+displayId);
      shell("am start --display "+displayId+" -n com.shatianrui.wereader/.MainActivity");Thread.sleep(3500);stages.put(inspect("settings-return-to-external"));
      shell("input -d "+displayId+" keyevent 4");Thread.sleep(3500);stages.put(inspect("closed-settings-external"));
      if(stages.toString().contains("\"clipped\":true"))throw new AssertionError("Clipped text; inspect densityReport");output.putString("densityReport",stages.toString());output.putString("result","PASS");finish(Activity.RESULT_OK,output);
    }catch(Throwable e){output.putString("result","FAIL: "+e);output.putString("densityReport",stages.toString());finish(Activity.RESULT_CANCELED,output);}
  }
}
