#!/usr/bin/env bash
set -euo pipefail

# Build and package Day as a Debian .deb package
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.3.0"
ARCH="amd64"
PKG_NAME="day"
PKG_FULL_NAME="${PKG_NAME}_${VERSION}_${ARCH}"
BUILD_DIR="${REPO_ROOT}/dist-deb/${PKG_FULL_NAME}"

echo "==> Preparing Debian package directory structure..."
rm -rf "${REPO_ROOT}/dist-deb"
mkdir -p "${BUILD_DIR}/DEBIAN"
mkdir -p "${BUILD_DIR}/usr/bin"
mkdir -p "${BUILD_DIR}/usr/share/applications"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/32x32/apps"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/256x256/apps"

echo "==> Copying binaries..."
install -m 755 "${REPO_ROOT}/windows/target/release/Day" "${BUILD_DIR}/usr/bin/day"
install -m 755 "${REPO_ROOT}/windows/target/release/Day-hook" "${BUILD_DIR}/usr/bin/day-hook"

echo "==> Copying desktop file and icons..."
install -m 644 "${REPO_ROOT}/linux/arch/day.desktop" "${BUILD_DIR}/usr/share/applications/day.desktop"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/32x32.png" "${BUILD_DIR}/usr/share/icons/hicolor/32x32/apps/day.png"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/128x128.png" "${BUILD_DIR}/usr/share/icons/hicolor/128x128/apps/day.png"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/128x128@2x.png" "${BUILD_DIR}/usr/share/icons/hicolor/256x256/apps/day.png"

# Calculate installed size in KB
INSTALLED_SIZE=$(du -sk "${BUILD_DIR}" | cut -f1)

echo "==> Generating DEBIAN/control file..."
cat <<EOF > "${BUILD_DIR}/DEBIAN/control"
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Installed-Size: ${INSTALLED_SIZE}
Maintainer: Sudhan <sudhan@example.com>
Depends: libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37, libgtk-3-0, libayatana-appindicator3-1, dbus, xdg-utils, hicolor-icon-theme
Description: Day lives at the top of your screen and keeps an eye on your Claude Code sessions.
 Day puts Day at the top of your screen: it shows your Claude Code sessions and
 a few integrations, and lets you approve, answer, chat and drop files without
 leaving what you are doing.
EOF

echo "==> Packaging into .deb..."
# Standard Debian packages are ar archives containing:
# 1. debian-binary (contains "2.0\n")
# 2. control.tar.gz (control metadata)
# 3. data.tar.xz (filesystem payload)
cd "${BUILD_DIR}"
echo "2.0" > debian-binary

tar -czf control.tar.gz -C DEBIAN control
tar -cJf data.tar.xz -C "${BUILD_DIR}" --exclude='./DEBIAN' --exclude='./debian-binary' --exclude='./control.tar.gz' --exclude='./data.tar.xz' usr

ar rcs "${REPO_ROOT}/${PKG_FULL_NAME}.deb" debian-binary control.tar.gz data.tar.xz

echo "==> Successfully created: ${REPO_ROOT}/${PKG_FULL_NAME}.deb"
