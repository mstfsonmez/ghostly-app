# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# SoLoader - libreact_featureflagsjni.so hatası için kritik
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native JNI
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.runtime.** { *; }

# Hermes
-keep class com.facebook.hermes.** { *; }

# React Native New Architecture
-keep class com.facebook.react.defaults.** { *; }
-keep class com.facebook.react.config.** { *; }

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Add any project specific keep options here:
