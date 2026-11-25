# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1](https://github.com/Amal-kphilip/CleanShot/compare/cleanshot-v1.1.0...cleanshot-v1.1.1) (2026-11-25)


### Bug Fixes

* **security:** resolve CodeQL scanning alerts and upgrade vulnerable dev dependencies ([#28](https://github.com/Amal-kphilip/CleanShot/issues/28)) ([ac31bba](https://github.com/Amal-kphilip/CleanShot/commit/ac31bbae3ba713d3b2ab342ce5029c175d6f48d5))

## [1.1.0](https://github.com/Amal-kphilip/CleanShot/compare/cleanshot-v1.0.0...cleanshot-v1.1.0) (2026-11-25)


### Features

* add app icon to navbar brand alongside wordmark ([ee82b61](https://github.com/Amal-kphilip/CleanShot/commit/ee82b61de9d301e7503a9713f203ddac882e7e26))
* add ham3 animated SVG hamburger menu toggle ([9127794](https://github.com/Amal-kphilip/CleanShot/commit/9127794cc941168349981164032963d3792f1728))
* add light and dark mode wordmark logos ([0c9d89a](https://github.com/Amal-kphilip/CleanShot/commit/0c9d89a76c08d5b83f1578fd4815507930b4f24b))
* add multi-format metadata stripping and simplify UI ([32c5cc7](https://github.com/Amal-kphilip/CleanShot/commit/32c5cc7e65467bc52b4f30dec28868eedff80039))
* default _clean filename suffix for easy discovery ([7c320a9](https://github.com/Amal-kphilip/CleanShot/commit/7c320a921de908bc53bff0b0ca75b4e2d53f2686))
* initial release of CleanShot lossless photo metadata stripper ([a01b1a6](https://github.com/Amal-kphilip/CleanShot/commit/a01b1a6768bdee7443ca0347edbc06f727bd46cb))
* integrate StripMeta privacy metadata removal into Gemini watermark remover ([e85f01f](https://github.com/Amal-kphilip/CleanShot/commit/e85f01f1125be1eaf499aa3324c66b5e513668fb))
* upgrade canonical metadata engine, fix mobile picker routing, add GIF watermark removal ([ed500ee](https://github.com/Amal-kphilip/CleanShot/commit/ed500ee34fe9534312c35c64c6ed1b2d8c5471b1))
* upgrade navbar design and add mobile navigation drawer ([cdfd0ec](https://github.com/Amal-kphilip/CleanShot/commit/cdfd0ec098d50a3b8dba70e32b7901810fe581d8))


### Bug Fixes

* add browser tab favicon and app icons ([2bda5ff](https://github.com/Amal-kphilip/CleanShot/commit/2bda5ffe55b3548c06b89e9088a3600f5b92b198))
* direct single file download instead of ZIP when only one photo is processed ([7e52567](https://github.com/Amal-kphilip/CleanShot/commit/7e52567e1631c6817f83f68a196fb252473dd4a4))
* harden GIF transparency, disposal=2, probing, and unchanged reporting ([4a159f9](https://github.com/Amal-kphilip/CleanShot/commit/4a159f94db8e4c71e2d5e16694c2f302916fc3f9))
* mobile alignment and manual strip trigger ([fb87526](https://github.com/Amal-kphilip/CleanShot/commit/fb87526355828f8f47ebb2c08646c734a1653236))
* run per-frame Gemini watermark engine and confidence probing on GIFs ([f7f0b63](https://github.com/Amal-kphilip/CleanShot/commit/f7f0b6381d643b4ff721b6111e310f70808056ca))
* separate image/video queues, auto-scroll workspace, and remove Beta badge ([50fc3a0](https://github.com/Amal-kphilip/CleanShot/commit/50fc3a035b14f864eb4ab3c58ac5a6c4d7090c80))
* show uploaded files in watermark remover dropzone and add Metadata back navigation ([ba0aa78](https://github.com/Amal-kphilip/CleanShot/commit/ba0aa78363bbc9959fe7688bec02f57a0b01d09a))
* strip C2PA, IPTC, and trailing AI metadata ([a7a5ed6](https://github.com/Amal-kphilip/CleanShot/commit/a7a5ed67f337f53e03a68c472099c794490e5d3d))


### Performance Improvements

* optimize render lag and upgrade mobile menu to dynamic glass ([d669113](https://github.com/Amal-kphilip/CleanShot/commit/d669113e24a4faae2a12610a4beee4160f41c6bc))

## [1.0.0] - 2026-11-25

### Added

- Initial open-source release of CleanShot (client-side metadata inspector, metadata remover, and Gemini watermark remover).
