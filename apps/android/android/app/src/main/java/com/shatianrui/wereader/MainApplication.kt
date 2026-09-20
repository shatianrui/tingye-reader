package com.shatianrui.wereader

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.view.Display

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  @Volatile private var readerDisplayContext: Context? = null

  fun useReaderDisplay(display: Display) {
    // One singleTask reader surface. Keep only a display context, never an Activity.
    readerDisplayContext = baseContext.createDisplayContext(display)
  }

  override fun getSystemService(name: String): Any? {
    // ReactHost also refreshes global font metrics from Application context.
    // Its WindowManager must not briefly return the phone's physical density
    // while Fabric is measuring text for an external display in another thread.
    if (name == Context.WINDOW_SERVICE) {
      readerDisplayContext?.let { return it.getSystemService(name) }
    }
    return super.getSystemService(name)
  }

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
