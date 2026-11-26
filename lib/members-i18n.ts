// Members app strings. Arabic in the same light Gulf register as the website.
export type MLang = "ar" | "en";

const en = {
  app: "Suhail Members", home: "Home", people: "People", board: "Board", intros: "Intros", invite: "Invite", me: "Profile",
  signIn: "Sign in", signOut: "Sign out", email: "Email", sendLink: "Send me a link", linkSent: "Check your email: we sent a sign-in link. It works once and expires in an hour.",
  notMember: "That address isn't a member yet. Ask a member for an invite, or apply.", paused: "Your membership is paused. Write to hello@suhail.build.", error: "Something went wrong. Try again.",
  inviteOnly: "Members only. For the people who build, fund and hire across the Arab world.", apply: "Apply", haveInvite: "Have an invite? Open the link you were sent.",
  join: "Join Suhail", joinLede: "You were invited by a member. Tell us who you are and we'll send you a sign-in link.", name: "Name", joinSend: "Send my link",
  badInvite: "This invite link has been used, has expired, or is for a different address.",
  applyLede: "Suhail Members is invite only. If you don't know a member yet, tell us what you've built and the team will reply within two weeks.",
  role: "What you do", building: "What you've built, or are building", link: "A link to something you made", city: "City", country: "Country", applySend: "Send application",
  applied: "Thanks. The team reads every application and replies within two weeks.",
  picks: "Today's picks", picksSub: "People worth meeting, chosen for what you're looking for", newWeek: "New this week", newWeekSub: "Say hello to the newest members",
  travel: "Who's traveling", travelSub: "Members on the move. Add your trip and see who's in town.", addTrip: "Add a trip", fromBoard: "From the board", seeAll: "See all",
  nobodyYet: "Nobody here yet.", comingTo: "coming to your city",
  search: "Search people, skills, cities", searchHelp: "Try \"ml riyadh cofounder\" or \"investor cairo\"", results: "people",
  lookingFor: "Looking for", skills: "Skills", askIntro: "Ask for an introduction", introNote: "Why do you want to meet? They'll see this before deciding.", introSent: "Sent. If they accept, you'll both get each other's email.",
  introPending: "Introduction requested", notOpen: "Not taking introductions right now.",
  incoming: "Waiting for you", outgoing: "You asked", accept: "Accept", decline: "Not for me", accepted: "Connected", declined: "Declined", pending: "Waiting",
  introAcceptedNote: "You're connected. Here's how to reach each other:",
  newPost: "Post to the board", title: "Title", body: "Details", kind: "Kind", when: "When", post: "Post", comment: "Comment", commentPh: "Add a comment", going: "Going", rsvp: "I'll come",
  kinds: { shipped: "Shipped", ask: "Ask", discussion: "Discussion", meetup: "Meetup" } as Record<string, string>,
  invitesLeft: "invites left", inviteLede: "Invite people you'd vouch for: people who build. Each link works once, for 30 days.", newInvite: "Create an invite link", forEmail: "Their email (optional)", copy: "Copy link", copied: "Copied", used: "Used", expires: "Expires",
  profile: "Your profile", save: "Save", saved: "Saved", headline: "Headline", headlinePh: "ML engineer at Careem", company: "Company", openIntros: "Open to introductions", language: "العربية",
  trips: "Your trips", from: "From", to: "To", note: "Note", remove: "Remove",
  looking: { cofounder: "A co-founder", hiring: "People to hire", job: "A job", funding: "Funding", collaborators: "Collaborators", mentor: "To mentor someone", mentee: "A mentor" } as Record<string, string>,
  roles: { Engineer: "Engineer", Founder: "Founder", Researcher: "Researcher", Designer: "Designer", Product: "Product", Investor: "Investor", Operator: "Operator", Student: "Student" } as Record<string, string>,
  welcome: "Welcome to Suhail", welcomeLede: "Fill in your profile so the right people can find you. It takes two minutes.",
  skillsPh: "python, llms, payments, react", linksH: "Links",
};
type Dict = typeof en;

const ar: Dict = {
  app: "أعضاء سهيل", home: "الرئيسية", people: "الناس", board: "اللوحة", intros: "التعارف", invite: "ادعُ", me: "ملفك",
  signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", email: "الإيميل", sendLink: "أرسل لي رابط", linkSent: "شوف إيميلك: أرسلنا رابط دخول. يشتغل مرة وحدة وينتهي خلال ساعة.",
  notMember: "هالعنوان مو عضو للحين. اطلب دعوة من عضو، أو قدّم.", paused: "عضويتك موقوفة. راسلنا على hello@suhail.build.", error: "صار خطأ. جرّب مرة ثانية.",
  inviteOnly: "للأعضاء فقط. للي يبنون ويموّلون ويوظّفون في العالم العربي.", apply: "قدّم", haveInvite: "عندك دعوة؟ افتح الرابط اللي وصلك.",
  join: "انضم لسهيل", joinLede: "دعاك عضو. قول لنا مين إنت ونرسل لك رابط دخول.", name: "الاسم", joinSend: "أرسل الرابط",
  badInvite: "رابط الدعوة هذا مستخدم، أو منتهي، أو لعنوان ثاني.",
  applyLede: "أعضاء سهيل بالدعوة فقط. إذا ما تعرف عضو للحين، قول لنا وش بنيت والفريق يرد خلال أسبوعين.",
  role: "وش تسوي", building: "وش بنيت، أو وش تبني الحين", link: "رابط لشي سويته", city: "المدينة", country: "الدولة", applySend: "أرسل الطلب",
  applied: "شكرًا. الفريق يقرا كل طلب ويرد خلال أسبوعين.",
  picks: "مختارات اليوم", picksSub: "ناس يستاهلون تتعرف عليهم، حسب اللي تدوّر عليه", newWeek: "جدد هالأسبوع", newWeekSub: "سلّم على أحدث الأعضاء",
  travel: "مين مسافر", travelSub: "أعضاء متنقلين. أضف رحلتك وشوف مين في المدينة.", addTrip: "أضف رحلة", fromBoard: "من اللوحة", seeAll: "الكل",
  nobodyYet: "ما فيه أحد للحين.", comingTo: "جاي مدينتك",
  search: "دوّر على ناس، مهارات، مدن", searchHelp: "جرّب \"ml riyadh cofounder\" أو \"investor cairo\"", results: "شخص",
  lookingFor: "يدوّر على", skills: "المهارات", askIntro: "اطلب تعارف", introNote: "ليش تبي تتعرف عليه؟ بيشوف هالكلام قبل لا يقرر.", introSent: "انرسل. إذا وافق، كل واحد فيكم يوصله إيميل الثاني.",
  introPending: "طلبت تعارف", notOpen: "ما يستقبل طلبات تعارف حاليًا.",
  incoming: "ينتظرونك", outgoing: "طلباتك", accept: "موافق", decline: "مو لي", accepted: "تم التعارف", declined: "اعتذر", pending: "بالانتظار",
  introAcceptedNote: "تعارفتوا. هذي طريقة التواصل:",
  newPost: "انشر في اللوحة", title: "العنوان", body: "التفاصيل", kind: "النوع", when: "متى", post: "انشر", comment: "علّق", commentPh: "أضف تعليق", going: "رايحين", rsvp: "بجي",
  kinds: { shipped: "أطلقت", ask: "سؤال", discussion: "نقاش", meetup: "لقاء" },
  invitesLeft: "دعوات باقية", inviteLede: "ادعُ ناس تزكّيهم: ناس يبنون. كل رابط يشتغل مرة وحدة، لمدة ٣٠ يوم.", newInvite: "سوّ رابط دعوة", forEmail: "إيميله (اختياري)", copy: "انسخ الرابط", copied: "انسخ", used: "مستخدم", expires: "ينتهي",
  profile: "ملفك", save: "احفظ", saved: "انحفظ", headline: "نبذة قصيرة", headlinePh: "مهندس تعلم آلي في كريم", company: "الشركة", openIntros: "أستقبل طلبات التعارف", language: "English",
  trips: "رحلاتك", from: "من", to: "إلى", note: "ملاحظة", remove: "احذف",
  looking: { cofounder: "شريك مؤسس", hiring: "ناس أوظفهم", job: "وظيفة", funding: "تمويل", collaborators: "ناس أشتغل معهم", mentor: "أرشد أحد", mentee: "مرشد" },
  roles: { Engineer: "مهندس", Founder: "مؤسس", Researcher: "باحث", Designer: "مصمم", Product: "منتج", Investor: "مستثمر", Operator: "تشغيل", Student: "طالب" },
  welcome: "حيّاك في سهيل", welcomeLede: "عبّ ملفك عشان الناس الصح يلقونك. ياخذ دقيقتين.",
  skillsPh: "python, llms, payments, react", linksH: "الروابط",
};

export const M = { en, ar };
export const mt = (lang: MLang) => M[lang];
