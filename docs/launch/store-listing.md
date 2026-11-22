# App Store and Google Play listing

*Ready-to-paste text for both stores, in Arabic and English. Written 22 November 2026. Nothing has been submitted.*

Character counts were checked with a script. Arabic counts letters, not bytes, which is how both stores count.

## 1. Basics (same in both stores)

| Field | Value |
| --- | --- |
| Bundle ID / package | `kw.yahal.app` (already in `apps/mobile/app.json`) |
| Version | 1.0.0 (build numbers go up by themselves, see `docs/launch/build-and-submit.md`) |
| Primary language | Arabic. Add English as a second localisation. |
| Category | **Lifestyle**. Secondary (Apple only): **Productivity**. Don't pick Medical: it brings stricter review and the app isn't a medical device. |
| Price | Free. No in-app purchases, no ads. |
| Countries | Kuwait first (you can add GCC later) |
| Age rating | Apple: answer "None" to everything except **Medical or treatment information: Infrequent** (the vaccination schedule and tips). That gives 4+. Google (IARC questionnaire): category "Reference, news or educational", no violence, no user-to-user chat, no location sharing. That gives Everyone / PEGI 3. |
| Kids category / Designed for Families | **No.** The app is for parents. In Google Play's "Target audience", tick **18 and over only**. If you tick a children's age group, the app falls under the Families policy, which it isn't built for. |
| Privacy policy URL | **Needed:** `https://[your domain]/privacy` (the page is ready in `store/privacy/index.html`) |
| Account deletion URL (Google only) | **Needed:** `https://[your domain]/privacy#delete` (same page, it has a "Delete your account" section) |
| Support URL | **Needed:** `https://[your domain]/support`, or the privacy page if you have no other page yet |
| Support email | **Needed:** `[support email]` |
| Marketing URL (optional) | `https://[your domain]` |
| Copyright (Apple) | `2026 [company legal name]` |

## 2. Names (30 characters max in both stores)

| | Arabic | English |
| --- | --- | --- |
| App name (Apple) / App name (Google) | ياهل: تنظيم شؤون أطفالك (23) | Yahal: Family & Kids Organiser (30) |
| Name under the icon on the phone | ياهل · Yahal (already set in `app.json`) | |

Before you submit, check nobody else already uses "Yahal" or "ياهل" in either store. A name that's already taken is refused when you create the app record.

## 3. Short text

**Apple subtitle (30 max)**
- AR: التقويم والتطعيمات والمستلزمات (30)
- EN: Calendar, vaccines & supplies (29)

**Google short description (80 max)**
- AR: مواعيد أطفالك وتطعيماتهم ومستلزماتهم في مكان واحد، بالعربي والإنجليزي. (70)
- EN: Your kids' calendar, vaccinations and supplies in one place, Arabic & English. (78)

**Apple promotional text (170 max, can be changed any time without review)**
- AR: نظّم يوم عائلتك مع شريك حياتك: مواعيد الأطفال، جدول التطعيمات، المستلزمات، والأدلة الحكومية في الكويت.
- EN: Plan your family's week together: kids' appointments, vaccinations, supplies and Kuwait government paperwork, in one shared app.

**Apple keywords (100 max, commas, no spaces needed)**
- AR: أطفال,تطعيمات,تقويم,حضانة,حفاضات,الكويت,أم,أب,مواعيد,صحة الطفل,مستلزمات,شهادة ميلاد (83)
- EN: kids,vaccination,Kuwait,family calendar,baby,parents,nursery,diapers,reminders,co-parent (88)

## 4. Long description (4,000 max, used by both stores)

> The line "kept on servers in Kuwait" is only true once the production server is running in Kuwait (launch list item 5). Remove that line if the server isn't there on the day you submit.

**AR**

ياهل يساعدك تنظّم كل ما يخص أطفالك في الكويت، مع شريك حياتك:

• تقويم العائلة: التمارين والدروس والمواعيد وجلسات العلاج، مع تذكير قبل الموعد. ادعُ الوالد الآخر ليرى نفس التقويم.
• جدول التطعيمات حسب وزارة الصحة لكل طفل، مع تذكير قبل كل تطعيم.
• المستلزمات: الحليب والحفاضات والمناديل وغيرها، وتنبيه عندما تقارب على النفاد، مع قائمة مقترحة حسب العمر.
• الأدلة الحكومية خطوة بخطوة: شهادة الميلاد، البطاقة المدنية، الجواز، الإقامة، المركز الصحي، المدرسة، وخدمات ذوي الإعاقة.
• دليل الأماكن: المستشفيات والعيادات والحضانات والمدارس ومراكز العلاج والأنشطة، مع الاتصال والواتساب والخريطة، وفعاليات الأطفال.
• نصائح يومية حسب عمر طفلك في النوم والتغذية والأنشطة والتعلّم والصحة، ويمكنك تخصيصها بالذكاء الاصطناعي.
• دعم الأطفال ذوي الاحتياجات الخاصة: نصائح ومستلزمات وتذكير بالجلسات وأدلة الخدمات.

خصوصيتك أولاً:
• بياناتكم محفوظة على خوادم داخل الكويت.
• لا نطلب الرقم المدني أو الجواز أو صور الأطفال.
• معلومات الاحتياجات الخاصة يراها والدا الطفل فقط، ولا تُرسل أبداً إلى الذكاء الاصطناعي.
• لا إعلانات ولا تتبّع، ويمكنك تنزيل بياناتك أو حذف حسابك في أي وقت من داخل التطبيق.

المعلومات الصحية في التطبيق عامة وليست نصيحة طبية. استشر طبيب طفلك دائماً، وفي الطوارئ اتصل بـ 112.

**EN**

Yahal helps you and your partner organise everything about your children in Kuwait:

• Family calendar: training, classes, appointments and therapy sessions, with reminders. Invite the other parent to share the same calendar.
• Each child's Ministry of Health vaccination schedule, with a reminder before every dose.
• Supplies: milk, diapers, wipes and more, with an alert when they run low and a suggested list for your child's age.
• Step-by-step government guides: birth certificate, civil ID, passport, residency, health centre, school and disability services.
• A directory of hospitals, clinics, nurseries, schools, therapy centres and activities, with call, WhatsApp and map buttons, plus kids' events.
• Daily tips for your child's age on sleep, feeding, activities, learning and health, which you can personalise with AI.
• Support for children with special needs: tips, supplies, session reminders and service guides.

Privacy first:
• Your data is kept on servers in Kuwait.
• We never ask for civil ID or passport numbers, or photos of children.
• Special needs information is seen only by the child's parents, and is never sent to the AI.
• No ads, no tracking, and you can download your data or delete your account at any time in the app.

Health information in the app is general and is not medical advice. Always check with your child's doctor. In an emergency call 112.

## 5. "What's new" for version 1.0.0

- AR: أول إصدار من ياهل. نسعد بملاحظاتكم على [بريد الدعم].
- EN: The first version of Yahal. We'd love your feedback at [support email].

## 6. Screenshots

### Sizes each store needs

| Store | Slot | Size (pixels, portrait) | Needed? | In this repo |
| --- | --- | --- | --- | --- |
| Apple | iPhone 6.9" | 1320 × 2868 | **Required** (Apple scales it down for smaller iPhones) | `store/screenshots/ios-6.9/ar/` and `/en/`, 6 each |
| Apple | iPhone 6.5" | 1284 × 2778 or 1242 × 2688 | Only if you don't upload 6.9" | Not needed |
| Apple | iPad 13" | 2064 × 2752 | **Required only while `supportsTablet` is `true`** in `app.json` | Not made, see below |
| Google | Phone | 1080 × 1920 (any 9:16 between 320 and 3,840 px) | **Required**, 2 to 8 | `store/screenshots/android-phone/ar/` and `/en/`, 6 each |
| Google | Feature graphic | 1024 × 500 | **Required** | `store/screenshots/android-feature-graphic/` (AR and EN) |
| Google | App icon | 512 × 512 | **Required** | `store/icons/android/play-store-icon-512.png` |
| Google | 7" and 10" tablet | | Optional | Not made |

All files are PNG with no transparency, which both stores accept. Apple allows up to 10 per language, Google up to 8.

**iPad:** `app.json` has `"supportsTablet": true`, so Apple will ask for iPad screenshots, and the app is reviewed on an iPad too. The app's screens are designed for phones. For version 1 I recommend switching this to `false`. iPads can still run the iPhone version, and no iPad screenshots are needed. If you'd rather keep iPad support, the iPad layout needs checking first, and I'll make 2064 × 2752 screenshots from it.

### The six screenshots and their captions

The screenshots are real screens of the app (web build, iPhone size), with a **made-up demo family**: "عائلة سالم / The Salem family", Sara (6 months) and Yousef (4 years). No real child is shown. Upload them in this order. The Arabic set goes in the Arabic localisation and the English set in the English one.

| # | Screen | Arabic caption | English caption |
| --- | --- | --- | --- |
| 1 | Home | يوم العائلة في شاشة واحدة · المواعيد والتطعيمات والنصائح لكل طفل | Your family's day at a glance · Events, vaccinations and tips for each child |
| 2 | Calendar | تقويم واحد لك ولشريكك · تمارين ودروس ومواعيد مع تذكير قبلها | One calendar for both parents · Training, classes and appointments, with reminders |
| 3 | Vaccinations | التطعيمات في وقتها · حسب جدول وزارة الصحة، مع تذكير قبل كل جرعة | Every vaccination, on time · Kuwait MOH schedule, with a reminder before each dose |
| 4 | Supplies | لا تتفاجأ بنفاد الحفاضات · تابع المستلزمات وتنبيه عندما تقارب على النفاد | Never run out of diapers · Track supplies and get an alert when they run low |
| 5 | Explore | المعاملات الحكومية خطوة بخطوة · شهادة الميلاد والبطاقة المدنية والجواز، ودليل الأماكن | Paperwork, step by step · Birth certificate, civil ID, passport, and a directory of places |
| 6 | Tips | نصائح تناسب عمر طفلك · النوم والتغذية والأنشطة والتعلّم | Tips for your child's age · Sleep, feeding, activities and learning |

Caption 3 names the Ministry of Health schedule. Only use it once the paediatrician has checked the schedule against the current MOH one (launch list item 14). Until then, the screen itself says "pending review", which is visible in screenshot 3.

How to make them again (for example after a design change) is in `store/README.md`.

## 7. Notes for the app reviewers

Apple and Google need to sign in, and they can't receive a Kuwaiti SMS.

1. In the production Supabase Auth settings, add **one** test phone number with a fixed code (the same idea as `[auth.sms.test_otp]` in `supabase/config.toml`).
2. Sign in with it once and set up a demo family with made-up children, like the screenshots.
3. Paste this into Apple's "App Review Information > Notes" and Google's "App access" section:

> Sign-in uses a phone number and a one-time SMS code. Please use the test account: country code +965, phone number [8 digits], code [6 digits]. It already has a demo family with two children. Account deletion: Family tab > Privacy and your data > Delete my account. The app is for parents; children do not use it.

4. Remove the test number after both stores approve the app.

## 8. Privacy forms

The answers for Apple's "App Privacy" and Google's "Data safety" are in [`privacy-labels.md`](privacy-labels.md), with the code each answer is based on.
