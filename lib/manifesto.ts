// The manifesto, grouped into paragraphs at its natural pauses. Arabic is the original; English is the translation.
// A block is a paragraph, a quotation (the opening words we answer, cited) or a pull quote (Ibn Khaldun), or a pair
// of contrasts set one per line. Each language shows on its own page; the text itself ends on the question.

export type Block = { p: string; last?: true } | { quote: string; by: string; style: "cited" | "pull" } | { lines: string[] };

export const TRANSCRIPT: Record<"ar" | "en", Block[]> = {
  ar: [
    { quote: "«فيه خمسمية مليون عربي… ومع ذلك… ما ينتجون علم. ما ياخذون جائزة نوبل. ولا جائزة فيلدز، ولا جائزة وولف. ما ينتجون أدب.»", by: "روبرت إف. كينيدي الابن، وزير الصحة الأمريكي، على C‑SPAN و Spectrum News", style: "cited" },
    { p: "شوفوا… هذا وزير الصحة في أكبر دولة في العالم، وواضح إنه ما فتح كتاب تاريخ في حياته." },
    { p: "طيّب يا معالي الوزير… خلّنا نعلّمك شوي." },
    { p: "كان في زمن، العالم كله يجي هنا عشان يتعلّم. الحضارة العربية والإسلامية كانت تقود العالم في الطب، والرياضيات، والفلك، والكيمياء، والبصريات، والهندسة، والجغرافيا، والفلسفة." },
    { p: "في بغداد، بدأ علم الجبر بكتاب للخوارزمي. واسمه… حتى إنت تقوله كل يوم بدون ما تنتبه: algorithm، اللي يمشي عليه كل جهاز في جيبك." },
    { p: "ولمّا كانت أوروبا تتعلّم الطب، كانت تتعلّمه من ابن سينا. ابن الهيثم، والزهراوي… أبو الجراحة. وابن ماجد… كانت النجوم خريطته في البحر. وفاطمة الفهرية أسّست في فاس أقدم جامعة باقية في العالم." },
    { p: "وتقول ما ناخذ نوبل؟ نجيب محفوظ أخذها في الأدب، وأحمد زويل في الكيمياء، وعمر ياغي أخذها السنة اللي فاتت." },
    { p: "يا معالي الوزير… قبل لا تتكلّم عنّا… اقرا عنّا." },
    { p: "بس خلّونا نكون صادقين مع نفسنا. هو ما يعرف تاريخنا… بس إحنا بعد، نسيناه." },
    { p: "مع الوقت… بطّلنا نصنع. وصرنا نقلّد… وابن خلدون قالها من زمان:" },
    { quote: "«المغلوبُ مولعٌ أبداً بالاقتداء بالغالب»", by: "ابن خلدون", style: "pull" },
    { p: "وأذكى شبابنا راحوا يبدعون عند غيرنا… وصار خيرنا لغيرنا. وصار الطموح: شهادة، ووظيفة مضمونة، وراتب آخر الشهر. ورضينا بهذا." },
    { p: "اليوم، ثورة صناعية جديدة تنكتب قدّام عيوننا. والأدوات صارت بإيد أي واحد عنده فكرة. بس في فرق بين…" },
    { lines: ["تستخدم ≠ تصنع", "موجود ≠ مؤثّر"] },
    { p: "وإحنا كنّا مؤثّرين." },
    { p: "والناس اللي يقدرون يعيدون هذا التأثير، عندنا، من المحيط إلى الخليج. بس متفرّقين." },
    { p: "وعشان هذا، بنجمعهم: اللي يبتكرون، واللي يموّلون، واللي يوظّفون، في مكان واحد. عشان العالم يجي هنا… يتعلّم." },
    { p: "أهلنا كانوا يقولون: إذا طلع سُهَيْل… برد الليل." },
    { p: "ولما يطلع سهيل هالمرة… إيش بنكون صنعنا؟", last: true },
  ],
  en: [
    { quote: "“There are five hundred million Arabs… And yet… they don't produce science. They don't win Nobel Prizes. No Fields Medal, no Wolf Prize. They don't produce literature.”", by: "Robert F. Kennedy Jr., US Secretary of Health and Human Services (C-SPAN / Spectrum News)", style: "cited" },
    { p: "Look… this is the health secretary of the most powerful country in the world, and he has clearly never opened a history book." },
    { p: "Well, Mr. Secretary… let us teach you a little." },
    { p: "There was a time when the whole world came here to learn. Arab and Islamic civilisation led the world in medicine, mathematics, astronomy, chemistry, optics, engineering, geography and philosophy." },
    { p: "In Baghdad, algebra began with a book by al-Khwarizmi. And his name… you say it every day without noticing: algorithm, what every device in your pocket runs on." },
    { p: "And when Europe was learning medicine, it learned it from Ibn Sina. Ibn al-Haytham, and al-Zahrawi… the father of surgery. And Ibn Majid… the stars were his map at sea. And Fatima al-Fihri founded, in Fez, the oldest university still standing in the world." },
    { p: "And you say we don't win Nobels? Naguib Mahfouz won it for literature, Ahmed Zewail for chemistry, and Omar Yaghi won it last year." },
    { p: "Mr. Secretary… before you talk about us… read about us." },
    { p: "But let's be honest with ourselves. He doesn't know our history… but we've forgotten it too." },
    { p: "Over time… we stopped making things. And we started imitating… Ibn Khaldun said it long ago:" },
    { quote: "“The defeated always love to imitate the victor.”", by: "Ibn Khaldun", style: "pull" },
    { p: "Our brightest young people went to create for others… and our best went to someone else. And ambition became: a degree, a secure job, and a salary at the end of the month. And we settled for that." },
    { p: "Today, a new industrial revolution is being written in front of us. And the tools are in the hands of anyone with an idea. But there's a difference between…" },
    { lines: ["using ≠ making", "present ≠ influential"] },
    { p: "And we were influential." },
    { p: "And the people who can bring that influence back are here, from the Atlantic to the Gulf. Just scattered." },
    { p: "So we're bringing them together: the ones who build, the ones who fund, the ones who hire, in one place. So the world comes here… to learn." },
    { p: "Our elders used to say: when Suhail rises… the night turns cool." },
    { p: "So when Suhail rises this time… what will we have made?", last: true },
  ],
};

