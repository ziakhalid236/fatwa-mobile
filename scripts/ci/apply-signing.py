#!/usr/bin/env python3
"""Make the generated Android project sign the release build with the upload keystore from the environment.
Needs: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. Usage: apply-signing.py <android/app/build.gradle>"""
import os, re, sys
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
# only the release build type switches from the debug key to the upload key
src, n2 = re.subn(r'(release \{\n(?:\s*//.*\n)*\s*)signingConfig signingConfigs\.debug', r'\1signingConfig signingConfigs.fatwaRelease', src, count=1)
if n1 != 1 or n2 != 1: sys.exit(f'could not patch signing config ({n1},{n2})')
open(path, 'w').write(src)
print('release signing enabled')
