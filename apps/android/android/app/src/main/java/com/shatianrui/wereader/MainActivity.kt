package com.shatianrui.wereader

import android.os.Build
import android.os.Bundle
import android.content.res.Configuration
import com.facebook.react.uimanager.DisplayMetricsHolder

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    // RN's process-wide metrics otherwise retain the phone display's density.
    // Initialize before Fabric mounts, using this Activity's actual display.
    prepareDisplayMetrics()
    super.onCreate(null)
    syncDisplayMetrics()
  }

  @Suppress("DEPRECATION")
  private fun prepareDisplayMetrics() {
    (application as MainApplication).useReaderDisplay(windowManager.defaultDisplay)
    DisplayMetricsHolder.initDisplayMetrics(this)
  }

  private fun syncDisplayMetrics() {
    prepareDisplayMetrics()
    window.decorView.requestLayout()
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    // Child views can remeasure synchronously inside the framework callback.
    prepareDisplayMetrics()
    super.onConfigurationChanged(newConfig)
    // ReactHost may refresh from Application context; restore Activity metrics last.
    syncDisplayMetrics()
  }

  override fun onResume() {
    prepareDisplayMetrics()
    super.onResume()
    syncDisplayMetrics()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
