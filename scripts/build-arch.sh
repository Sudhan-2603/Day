#!/usr/bin/env bash
set -euo pipefail

# Build Arch Linux .pkg.tar.zst package directly from the local built release binaries
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.3.0"
RELEASE="1"
ARCH="x86_64"
PKG_NAME="day"
PKG_FULL_NAME="${PKG_NAME}-${VERSION}-${RELEASE}-${ARCH}"
BUILD_DIR="${REPO_ROOT}/dist-arch/${PKG_FULL_NAME}"

echo "==> Preparing Arch Linux package directory structure..."
rm -rf "${REPO_ROOT}/dist-arch"
mkdir -p "${BUILD_DIR}/usr/bin"
mkdir -p "${BUILD_DIR}/usr/share/applications"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/32x32/apps"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/128x128/apps"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/256x256/apps"

echo "==> Copying binaries..."
install -m 755 "${REPO_ROOT}/windows/target/release/Day" "${BUILD_DIR}/usr/bin/day"
install -m 755 "${REPO_ROOT}/windows/target/release/Day-hook" "${BUILD_DIR}/usr/bin/day-hook"

echo "==> Copying desktop entry and icons..."
install -m 644 "${REPO_ROOT}/linux/arch/day.desktop" "${BUILD_DIR}/usr/share/applications/day.desktop"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/32x32.png" "${BUILD_DIR}/usr/share/icons/hicolor/32x32/apps/day.png"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/128x128.png" "${BUILD_DIR}/usr/share/icons/hicolor/128x128/apps/day.png"
install -m 644 "${REPO_ROOT}/windows/src-tauri/icons/128x128@2x.png" "${BUILD_DIR}/usr/share/icons/hicolor/256x256/apps/day.png"

# Calculate installed size in bytes
INSTALLED_SIZE=$(du -sb "${BUILD_DIR}" | cut -f1)
BUILD_DATE=$(date -u +%s)

echo "==> Generating .PKGINFO..."
cat <<EOF > "${BUILD_DIR}/.PKGINFO"
pkgname = ${PKG_NAME}
pkgbase = ${PKG_NAME}
pkgver = ${VERSION}-${RELEASE}
pkgdesc = Day lives at the top of your screen and keeps an eye on your Claude Code sessions
url = https://github.com/Sudhan-2603/day
builddate = ${BUILD_DATE}
packager = Sudhan <sudhan@local>
size = ${INSTALLED_SIZE}
arch = ${ARCH}
license = MIT
depend = webkit2gtk-4.1
depend = gtk3
depend = gtk-layer-shell
depend = libayatana-appindicator
depend = gst-plugins-base
depend = gst-plugins-good
depend = dbus
depend = xdg-utils
depend = hicolor-icon-theme
optdepend = gnome-keyring: store API keys
optdepend = kwallet: store API keys
provides = day
makepkgopt = !lto
makepkgopt = !debug
EOF

echo "==> Generating .MTREE..."
cd "${BUILD_DIR}"
# Create standard pacman .MTREE specification
LANG=C bsdtar -czf .MTREE --format=mtree \
  --options='!all,use-set,type,uid,gid,mode,time,size,md5,sha256,link' \
  .PKGINFO usr

echo "==> Packaging into ${PKG_FULL_NAME}.pkg.tar.zst..."
LANG=C bsdtar --no-fflags -cf - .PKGINFO .MTREE usr | zstd -c -T0 --ultra -20 - > "${REPO_ROOT}/${PKG_FULL_NAME}.pkg.tar.zst"

echo "==> Successfully created: ${REPO_ROOT}/${PKG_FULL_NAME}.pkg.tar.zst"
