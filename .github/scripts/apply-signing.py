#!/usr/bin/env python3
"""Make the generated Android project sign the release build with the upload keystore from the environment.
Needs: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. Usage: apply-signing.py <android/app/build.gradle>"""
import os, re, sys
required = ('ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD')
missing = [name for name in required if not os.environ.get(name)]
if missing:
    sys.exit(f'missing signing environment variables: {", ".join(missing)}')
if len(sys.argv) != 2:
    sys.exit('usage: apply-signing.py <android/app/build.gradle>')
path = sys.argv[1]
src = open(path).read()
if 'fatwaRelease' in src: sys.exit(0)
block = '''        fatwaRelease {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            storeType "PKCS12"
        }
'''
src, n1 = re.subn(r'(signingConfigs \{\n)', r'\1' + block.replace('\\', '\\\\'), src, count=1)
# only the release build type switches from the debug key to the upload key;
# Expo/React Native templates may emit either `signingConfig ...` or `signingConfig = ...`.
src, n2 = re.subn(r'(release \{\n(?:\s*//.*\n)*\s*)signingConfig\s*(?:=\s*)?signingConfigs\.debug', r'\1signingConfig = signingConfigs.fatwaRelease', src, count=1)
if n1 != 1 or n2 != 1: sys.exit(f'could not patch signing config ({n1},{n2})')
open(path, 'w').write(src)
print('release signing enabled')
