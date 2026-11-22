// The privacy notice parents agree to when they create a family.
// DRAFT: must be reviewed by a lawyer against Kuwait's CITRA Data Privacy
// Protection Regulation before launch. Text in [brackets] is for Ezzo to fill in.
// When the wording changes in a way that matters, publish a new version in
// public.privacy_versions and update PRIVACY_VERSION in lib/api.ts.
export type NoticeSection = { title: string; body: string };

export const privacyNotice: Record<'ar' | 'en', NoticeSection[]> = {
  ar: [
    { title: 'من نحن', body: 'ياهل تطبيق لتنظيم شؤون الأطفال في الكويت، تديره [الاسم القانوني للشركة]. للتواصل بشأن الخصوصية: [بريد الخصوصية].' },
    {
      title: 'ما الذي نحفظه',
      body: 'رقم هاتفك (لتسجيل الدخول فقط). اسم العائلة. عن كل طفل: الاسم الأول وتاريخ الميلاد والجنس، والجنسية بشكل عام (كويتي / خليجي / أخرى) إن اخترتها. ما تضيفه بنفسك: مواعيد التقويم، سجل التطعيمات، المستلزمات، تقدّمك في الأدلة الحكومية. إعدادات التنبيهات ورمز الإشعارات لهاتفك. سجلات أمان قصيرة (أوقات محاولات رموز الدعوة واستخدام الذكاء الاصطناعي) لمنع إساءة الاستخدام.\nلا نطلب أبداً الرقم المدني أو رقم الجواز أو صور الأطفال.',
    },
    {
      title: 'الاحتياجات الخاصة (بيانات حساسة)',
      body: 'إن اخترت ذلك، تحفظ لطفلك احتياجاته الخاصة وملاحظة قصيرة وهل لديه بطاقة إعاقة. هذه بيانات صحية حساسة: يراها والدا الطفل في العائلة فقط، ولا تُرسل أبداً إلى الذكاء الاصطناعي، ولا تُكتب في نص الإشعارات، ولا يراها فريق ياهل. يمكنك مسحها في أي وقت من صفحة الطفل.',
    },
    { title: 'لماذا', body: 'لنعرض لك التقويم والتطعيمات والمستلزمات والنصائح المناسبة لعمر طفلك، ولنرسل لك التذكيرات التي تختارها. لا شيء غير ذلك.' },
    {
      title: 'من يرى بياناتك',
      body: 'أنت والوالد الآخر الذي تدعوه فقط. فريق ياهل لا يستطيع رؤية بيانات العائلات. لا نبيع البيانات، ولا نعرض إعلانات مبنية على بيانات أطفالك.',
    },
    {
      title: 'أين تُحفظ',
      body: 'على خوادم داخل الكويت. رمز الدخول يُرسل برسالة نصية عبر مزوّد الرسائل [اسم المزوّد]. عند تسجيل الدخول يتحقق Cloudflare Turnstile أنك لست برنامجاً آلياً، باستخدام عنوان IP ومعلومات المتصفح في الجهاز. التذكيرات تمر عبر خدمة الإشعارات من Expo وApple وGoogle، وقد تحتوي على الاسم الأول لطفلك واسم الموعد.',
    },
    {
      title: 'الذكاء الاصطناعي',
      body: 'عند استخدامك «خصّص النصائح» نرسل لمزوّد الذكاء الاصطناعي عمر طفلك بالأشهر وجنسه فقط، دون الاسم أو أي شيء آخر. قد يكون المزوّد خارج الكويت، ولا يستخدم هذه البيانات لتدريب نماذجه.',
    },
    {
      title: 'حقوقك',
      body: 'يمكنك في أي وقت من «العائلة ← الخصوصية وبياناتك» تنزيل نسخة من كل بياناتك، أو حذف حسابك نهائياً. الحذف فوري. النسخ الاحتياطية على الخادم تُمحى تلقائياً خلال [عدد] يوماً.',
    },
    { title: 'التغييرات', body: 'إذا غيّرنا هذا الإشعار تغييراً مهماً، سنطلب موافقتك من جديد داخل التطبيق.' },
  ],
  en: [
    { title: 'Who we are', body: 'Yahal is an app for organising family life with children in Kuwait, run by [company legal name]. Privacy contact: [privacy email].' },
    {
      title: 'What we keep',
      body: "Your phone number (for sign-in only). Your family name. For each child: first name, birth date, gender, and a broad nationality group (Kuwaiti / GCC / other) if you choose one. What you add yourself: calendar events, vaccination records, supplies, and your progress in government guides. Your reminder settings and your phone's notification token. Short security logs (times of invite-code attempts and AI requests) to stop abuse.\nWe never ask for civil ID or passport numbers, or photos of children.",
    },
    {
      title: 'Special needs (sensitive data)',
      body: "If you choose to, you can save your child's special needs, a short note and whether they have a disability card. This is sensitive health data: only the child's parents in your family can see it. It is never sent to the AI, never written into notification text, and the Yahal team cannot see it. You can clear it at any time from the child's page.",
    },
    { title: 'Why', body: "To show you the calendar, vaccinations, supplies and tips that fit your child's age, and to send the reminders you choose. Nothing else." },
    {
      title: 'Who can see it',
      body: "Only you and the other parent you invite. The Yahal team cannot see family data. We don't sell data, and we don't show ads based on your children's data.",
    },
    {
      title: 'Where it is kept',
      body: "On servers in Kuwait. Your sign-in code is sent by SMS through [SMS provider]. At sign-in, Cloudflare Turnstile checks that you are not a bot, using your IP address and browser information from the device. Reminders pass through the Expo, Apple and Google notification services and can include your child's first name and the event name.",
    },
    {
      title: 'AI',
      body: "When you use \"Personalise with AI\", we send the AI provider only your child's age in months and gender, never the name or anything else. The provider may be outside Kuwait and does not train its models on this data.",
    },
    {
      title: 'Your rights',
      body: 'At any time, from Family > Privacy and your data, you can download a copy of all your data or permanently delete your account. Deletion is immediate. Server backups are erased automatically within [number] days.',
    },
    { title: 'Changes', body: "If we change this notice in a way that matters, we'll ask for your agreement again in the app." },
  ],
};
