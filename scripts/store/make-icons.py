# Run: python3 scripts/store/make-icons.py  (needs Pillow)
# Builds every store/platform icon size from the app's own 1024 masters.
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = f'{ROOT}/apps/mobile/assets'
OUT = f'{ROOT}/store/icons'
master = Image.open(f'{A}/icon.png').convert('RGB')
fg = Image.open(f'{A}/android-icon-foreground.png').convert('RGBA')
bg = Image.open(f'{A}/android-icon-background.png').convert('RGB')
mono = Image.open(f'{A}/android-icon-monochrome.png').convert('RGBA')
def save(im, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize((size, size), Image.LANCZOS).save(path, optimize=True)

# ---- iOS (AppIcon.appiconset, opaque, square: iOS rounds the corners itself)
ios = [  # (idiom, point size, scale)
 ('iphone',20,2),('iphone',20,3),('iphone',29,2),('iphone',29,3),('iphone',40,2),('iphone',40,3),('iphone',60,2),('iphone',60,3),
 ('ipad',20,1),('ipad',20,2),('ipad',29,1),('ipad',29,2),('ipad',40,1),('ipad',40,2),('ipad',76,1),('ipad',76,2),('ipad',83.5,2),
 ('ios-marketing',1024,1)]
imgs=[]
for idiom,pt,sc in ios:
    px=int(pt*sc); name=f'icon-{px}.png'
    save(master, f'{OUT}/ios/AppIcon.appiconset/{name}', px)
    imgs.append({'idiom':idiom,'size':f'{pt:g}x{pt:g}','scale':f'{sc}x','filename':name})
json.dump({'images':imgs,'info':{'version':1,'author':'xcode'}}, open(f'{OUT}/ios/AppIcon.appiconset/Contents.json','w'), indent=2)
save(master, f'{OUT}/ios/app-store-icon-1024.png', 1024)

# ---- Android legacy launcher (48dp) square + round, and adaptive layers (108dp)
dens={'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
# adaptive composite at 1024 to derive legacy icons
comp = bg.resize(fg.size).convert('RGBA'); comp.alpha_composite(fg)
for d,m in dens.items():
    L=int(48*m); P=int(108*m)
    # legacy square icon: Android shows it as-is, so give it rounded corners
    sq = comp.crop((int(fg.width*18/108),)*2+(int(fg.width*90/108),)*2).resize((L,L),Image.LANCZOS)
    mask = Image.new('L',(L*4,L*4),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,L*4-1,L*4-1),radius=int(L*4*0.18),fill=255)
    os.makedirs(f'{OUT}/android/mipmap-{d}', exist_ok=True)
    sq.putalpha(mask.resize((L,L),Image.LANCZOS)); sq.save(f'{OUT}/android/mipmap-{d}/ic_launcher.png')
    rd = comp.crop((int(fg.width*18/108),)*2+(int(fg.width*90/108),)*2).resize((L,L),Image.LANCZOS)
    mask = Image.new('L',(L*4,L*4),0); ImageDraw.Draw(mask).ellipse((0,0,L*4-1,L*4-1),fill=255)
    rd.putalpha(mask.resize((L,L),Image.LANCZOS)); rd.save(f'{OUT}/android/mipmap-{d}/ic_launcher_round.png')
    fg.resize((P,P),Image.LANCZOS).save(f'{OUT}/android/mipmap-{d}/ic_launcher_foreground.png')
    bg.resize((P,P),Image.LANCZOS).save(f'{OUT}/android/mipmap-{d}/ic_launcher_background.png')
    mono.resize((P,P),Image.LANCZOS).save(f'{OUT}/android/mipmap-{d}/ic_launcher_monochrome.png')
os.makedirs(f'{OUT}/android/mipmap-anydpi-v26', exist_ok=True)
xml='''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
'''
for n in ('ic_launcher.xml','ic_launcher_round.xml'): open(f'{OUT}/android/mipmap-anydpi-v26/{n}','w').write(xml)
# Google Play listing icon: 512x512, 32-bit PNG with alpha allowed, square (Play masks it)
master.resize((512,512),Image.LANCZOS).save(f'{OUT}/android/play-store-icon-512.png')
print('ok')
