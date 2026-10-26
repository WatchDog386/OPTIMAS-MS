# Android build toolchain for building the Optimas MS APK on the server (used by deploy/build-android.sh).
# JDK 17 + Node 22 + Android SDK command-line tools. Gradle downloads the exact SDK platform, build tools and
# NDK the project asks for (licences are pre-accepted below), and they are cached in a Docker volume.
FROM eclipse-temurin:17-jdk

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip git ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/tools.zip \
 && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" > /dev/null

WORKDIR /work
