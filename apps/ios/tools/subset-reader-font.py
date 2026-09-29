"""Subset Noto Serif CJK SC for the app bundle.

The upstream OTF (see assets/fonts/SOURCES.json) carries ~45k code points and
weighs ~24 MB. Books are overwhelmingly covered by GB2312 (simplified) plus
Big5 level-1 (common traditional); rarer characters fall back per glyph to the
system font. Hangul is dropped; all other non-Han code points (Latin,
punctuation, kana, symbols) are kept, as are all OpenType layout features
(vertical forms, ligatures).

LXGW WenKai Lite is NOT subset here: its OFL declares Reserved Font Names that
only permit subsetting for web font delivery.

Usage: pip install fonttools
       python3 tools/subset-reader-font.py <upstream.otf> assets/fonts/NotoSerifCJKsc-Regular.otf
"""
import sys
from fontTools import subset
from fontTools.ttLib import TTFont


def encoded_chars(codec, first, last):
    chars = set()
    for code in range(first, last + 1):
        try:
            chars.add(code.to_bytes(2, 'big').decode(codec))
        except UnicodeDecodeError:
            pass
    return chars


def is_han(cp):
    return 0x3400 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x3FFFF


def is_hangul(cp):
    return 0x1100 <= cp <= 0x11FF or 0x3130 <= cp <= 0x318F or 0xA960 <= cp <= 0xA97F or 0xAC00 <= cp <= 0xD7FF


def main(source, target):
    font = TTFont(source)
    cmap = font.getBestCmap()
    # GB2312 hanzi occupy rows 0xB0-0xF7; Big5 level 1 is 0xA440-0xC67E.
    wanted = encoded_chars('gb2312', 0xA1A1, 0xF7FE) | encoded_chars('big5', 0xA440, 0xC67E)
    unicodes = [cp for cp in cmap if not is_hangul(cp) and (not is_han(cp) or chr(cp) in wanted)]
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_outline = True
    options.glyph_names = False
    options.hinting = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.save(target)
    print(f'{len(unicodes)} of {len(cmap)} code points kept -> {target}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
