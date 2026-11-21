# App Store and Google Play listing (draft)

*Draft text for Ezzo to check. Nothing here has been submitted.*

## Basics

| Field | Value |
| --- | --- |
| App name | Yahal · ياهل |
| Bundle ID / package | `kw.yahal.app` (both stores) |
| Category | Lifestyle (secondary: Medical is **not** recommended, it brings stricter review) |
| Age rating | 4+ / Everyone. The app is for parents; children don't use it. |
| Price | Free, no in-app purchases (bookings and payments are Phase 2) |
| Countries | Kuwait first |
| Languages | Arabic (primary), English |
| Privacy policy URL | **Needed:** host the final privacy notice on a web page (e.g. `https://yahal.kw/privacy`) |
| Support URL / email | **Needed** |

## Subtitle (30 characters max)

- AR: كل ما يخص أطفالك في مكان واحد
- EN: Your children, all in one place

## Description

**AR**

ياهل يساعدك تنظّم كل ما يخص أطفالك في الكويت، مع شريك حياتك:

• تقويم العائلة: التمارين والدروس والمواعيد، مع تذكيرات قبل الموعد.
• جدول التطعيمات حسب وزارة الصحة لكل طفل، مع تذكير قبل كل تطعيم.
• المستلزمات: الحليب والحفاضات والمناديل وغيرها، وتنبيه عندما تقارب على النفاد، مع اقتراحات حسب العمر.
• الأدلة الحكومية خطوة بخطوة: شهادة الميلاد، البطاقة المدنية، الجواز، الإقامة، المركز الصحي والمدرسة.
• دليل الأماكن: المستشفيات والعيادات والحضانات والمدارس والأنشطة، مع الاتصال والواتساب والخريطة.
• نصائح يومية حسب عمر طفلك في النوم والتغذية والأنشطة والتعلّم والصحة.

خصوصيتك أولاً: بياناتكم محفوظة على خوادم داخل الكويت، لا نطلب الرقم المدني أو الجواز، ويمكنك تنزيل بياناتك أو حذف حسابك في أي وقت.

المعلومات الصحية في التطبيق عامة وليست نصيحة طبية. استشر طبيب طفلك دائماً.

**EN**

Yahal helps you and your partner organise everything about your children in Kuwait:

• Family calendar: training, classes and appointments, with reminders.
• Each child's Ministry of Health vaccination schedule, with a reminder before every dose.
• Supplies: milk, diapers, wipes and more, with an alert when they run low and suggestions by age.
• Step-by-step government guides: birth certificate, civil ID, passport, residency, health centre and school.
• A directory of hospitals, clinics, nurseries, schools and activities, with call, WhatsApp and map buttons.
• Daily tips for your child's age on sleep, feeding, activities, learning and health.

Privacy first: your data is kept on servers in Kuwait, we never ask for civil ID or passport numbers, and you can download your data or delete your account at any time.

Health information in the app is general and is not medical advice. Always check with your child's doctor.

## Keywords (App Store, 100 characters)

- AR: أطفال,تطعيمات,تقويم,حضانة,حفاضات,الكويت,أم,أب,مواعيد,صحة الطفل
- EN: kids,vaccination,Kuwait,family calendar,baby,parents,nursery,diapers,reminders

## Screenshots

Needed in Arabic and English for 6.9" and 6.5" iPhone and for Android phones:
1. Home
2. Calendar
3. Vaccinations
4. Supplies
5. Explore
6. Tips

Use a **demo family** with made-up names, never a real child.

## Privacy answers (Apple "App Privacy" / Google "Data safety")

| Data | Collected | Linked to the user | Used for tracking | Why |
| --- | --- | --- | --- | --- |
| Phone number | Yes | Yes | No | Sign-in |
| Name (child's first name, family name) | Yes | Yes | No | App features |
| Health (vaccination records) | Yes | Yes | No | App features |
| Other user content (calendar, supplies) | Yes | Yes | No | App features |
| Device ID (push notification token) | Yes | Yes | No | Reminders |

- **No** tracking, **no** ads, **no** data sold.
- Data is encrypted in transit.
- Users can delete their data in the app: **Family › Privacy and your data**.

The iOS privacy manifest in `apps/mobile/app.json` declares the same list.

## Notes for the app reviewers

Apple and Google need to sign in, and they can't receive a Kuwaiti SMS. Give them a **review phone number with a fixed code**. In production Auth settings, add one test number and code (the same as `[auth.sms.test_otp]` in `supabase/config.toml`), give it a demo family, and paste it into "App Review Information". Remove it after approval.
