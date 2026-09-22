#!/usr/bin/env python3
"""Make a light preview copy of a variable master: Latin subset, WOFF2,
variation tables kept so the browser can drive every axis live.
Usage: preview_font.py <master.ttf> <out.woff2>"""
import sys
from fontTools import subset

src, out = sys.argv[1], sys.argv[2]
opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.glyph_names = False
opts.hinting = False
font = subset.load_font(src, opts)
s = subset.Subsetter(opts)
s.populate(unicodes=list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2212, 0x0237, 0x02C6, 0x02C7, 0x02D8, 0x02D9, 0x02DA, 0x02DB, 0x02DC, 0x02DD, 0xFB01, 0xFB02])
s.subset(font)
subset.save_font(font, out, opts)
