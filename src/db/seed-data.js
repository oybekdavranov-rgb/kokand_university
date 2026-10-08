'use strict';
/**
 * BOSHLANG'ICH KONTENT (3-versiya) — Kokand University haqidagi haqiqiy ma'lumotlar.
 * Manba: kokanduni.uz (2026-yil oktabr holati): bosh sahifa, /static/specializations,
 * /static/about-university, /static/organizational-structure, /static/contacts,
 * /international-cooperation-relations/joint-degree, /startups va yangiliklar.
 *
 * Har bir yozuvda `i18n: { ru: {...}, en: {...} }` — tayyor tarjimalar
 * (content_i18n jadvaliga yoziladi, shuning uchun sayt darhol uch tilda ishlaydi).
 * Admin keyin o'zgartirsa — avto-tarjima qayta ishlaydi.
 */
const OFFICIAL = 'https://www.kokanduni.uz';
const ADMISSION = 'https://qabul.kokanduni.uz';

/* ============================ YO'NALISHLAR ============================ */
const FAQ_APPLY = {
  uz: 'Hujjat qanday topshiriladi? :: Qabul platformasi orqali onlayn: qabul.kokanduni.uz',
  ru: 'Как подать документы? :: Онлайн через платформу приёма: qabul.kokanduni.uz',
  en: 'How do I apply? :: Online via the admissions portal: qabul.kokanduni.uz',
};
const FAQ_JOINT_BIZ = {
  uz: 'Xorijda o‘qish imkoniyati bormi? :: Ha. Qo‘shma ta’lim dasturlari doirasida 4-semestrda ariza topshirib, o‘qishni Janubiy Koreyadagi hamkor universitetlarda (SolBridge, Woosong, Joongbu) davom ettirish mumkin.',
  ru: 'Можно ли учиться за рубежом? :: Да. В рамках совместных программ можно подать заявку на 4-м семестре и продолжить обучение в университетах-партнёрах в Южной Корее (SolBridge, Woosong, Joongbu).',
  en: 'Can I study abroad? :: Yes. Through the joint programmes you can apply in the 4th semester and continue at partner universities in South Korea (SolBridge, Woosong, Joongbu).',
};
const FAQ_JOINT_IT = {
  uz: 'Xorijda o‘qish imkoniyati bormi? :: Ha. Qo‘shma ta’lim dasturi doirasida o‘qishni Rigadagi Transport and Telecommunication Institute’da (Latviya) davom ettirish mumkin.',
  ru: 'Можно ли учиться за рубежом? :: Да. В рамках совместной программы можно продолжить обучение в Transport and Telecommunication Institute (Рига, Латвия).',
  en: 'Can I study abroad? :: Yes. Through the joint programme you can continue at the Transport and Telecommunication Institute in Riga, Latvia.',
};

const F = {
  edu: { uz: 'Ta’lim va pedagogika', ru: 'Образование и педагогика', en: 'Education and pedagogy' },
  lang: { uz: 'Tillar va filologiya', ru: 'Языки и филология', en: 'Languages and philology' },
  econ: { uz: 'Iqtisodiyot va moliya', ru: 'Экономика и финансы', en: 'Economics and finance' },
  it: { uz: 'IT va muhandislik', ru: 'IT и инженерия', en: 'IT and engineering' },
  soc: { uz: 'Ijtimoiy-gumanitar fanlar', ru: 'Социально-гуманитарные науки', en: 'Social sciences and humanities' },
  tour: { uz: 'Turizm va servis', ru: 'Туризм и сервис', en: 'Tourism and hospitality' },
};
const DAY = 17141760;
const DAY_PLUS = 18411520;
const DIST_PLUS = 14729216;
const DIST = 13713408;
const MASTER = 20252672;

function priceText(day, dist) {
  return [`Kunduzgi :: ${day}`].concat(dist ? [`Masofaviy :: ${dist}`] : []).join('\n');
}
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function fmtEn(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function faqPrice(day, dist) {
  return {
    uz: `Kontrakt narxi qancha? :: Kunduzgi — ${fmt(day)} so‘m${dist ? `; masofaviy — ${fmt(dist)} so‘m` : ''} (2026/2027 o‘quv yili).`,
    ru: `Сколько стоит обучение? :: Очная форма — ${fmt(day)} сум${dist ? `; дистанционная — ${fmt(dist)} сум` : ''} (2026/2027 учебный год).`,
    en: `How much is tuition? :: Full-time — UZS ${fmtEn(day)}${dist ? `; distance — UZS ${fmtEn(dist)}` : ''} (2026/2027 academic year).`,
  };
}
function faq(...items) {
  return { uz: items.map((x) => x.uz).join('\n'), ru: items.map((x) => x.ru).join('\n'), en: items.map((x) => x.en).join('\n') };
}

/**
 * p(key, level, code, field, forms, [day, dist], title{uz,ru,en}, intro{...}, highlights{...}, extraFaq, language{...})
 */
function prog(o) {
  const forms = o.dist ? 'Kunduzgi, Masofaviy' : 'Kunduzgi';
  const levelUz = o.level === 'magistratura' ? 'Magistratura' : 'Bakalavriat';
  const levelRu = o.level === 'magistratura' ? 'Магистратура' : 'Бакалавриат';
  const levelEn = o.level === 'magistratura' ? 'Master’s' : 'Bachelor’s';
  const formsRu = o.dist ? 'очная, дистанционная' : 'очная';
  const formsEn = o.dist ? 'full-time, distance' : 'full-time';
  const f = faq(faqPrice(o.day, o.dist), FAQ_APPLY, ...(o.joint ? [o.joint] : []));
  return {
    key: o.key, level: o.level || 'bakalavr', code: o.code, field: o.field.uz, forms,
    price: priceText(o.day, o.dist), duration: '', language: o.language ? o.language.uz : '',
    title: o.title.uz,
    subtitle: `${levelUz} · ${o.code} · ${o.dist ? 'kunduzgi va masofaviy' : 'kunduzgi'}`,
    image: '', intro: o.intro.uz, highlights: o.hl.uz, faq: f.uz, link: ADMISSION,
    i18n: {
      ru: { title: o.title.ru, subtitle: `${levelRu} · ${o.code} · ${formsRu}`, field: o.field.ru, intro: o.intro.ru, highlights: o.hl.ru, faq: f.ru, language: o.language ? o.language.ru : '' },
      en: { title: o.title.en, subtitle: `${levelEn} · ${o.code} · ${formsEn}`, field: o.field.en, intro: o.intro.en, highlights: o.hl.en, faq: f.en, language: o.language ? o.language.en : '' },
    },
  };
}

const PROGRAMMES = [
  prog({
    key: 'kompyuter-injiniringi', code: '60610300', field: F.it, day: DAY_PLUS, dist: DIST_PLUS, joint: FAQ_JOINT_IT,
    title: { uz: 'Kompyuter injiniringi', ru: 'Компьютерная инженерия', en: 'Computer Engineering' },
    intro: {
      uz: 'Kompyuter tizimlari, dasturiy ta’minot va tarmoqlarni loyihalash hamda ishlab chiqishga yo‘naltirilgan muhandislik yo‘nalishi. Kunduzgi va masofaviy shakllarda o‘qitiladi; qo‘shma dastur orqali o‘qishni Latviyada davom ettirish mumkin.',
      ru: 'Инженерное направление, ориентированное на проектирование и разработку компьютерных систем, программного обеспечения и сетей. Обучение очно и дистанционно; по совместной программе можно продолжить учёбу в Латвии.',
      en: 'An engineering programme focused on designing and building computer systems, software and networks. Available full-time and by distance learning; the joint programme lets you continue your studies in Latvia.',
    },
    hl: {
      uz: 'Dasturlash va algoritmlar\nKompyuter arxitekturasi va operatsion tizimlar\nKompyuter tarmoqlari\nMa’lumotlar bazalari\nDasturiy ta’minot muhandisligi',
      ru: 'Программирование и алгоритмы\nАрхитектура компьютеров и операционные системы\nКомпьютерные сети\nБазы данных\nПрограммная инженерия',
      en: 'Programming and algorithms\nComputer architecture and operating systems\nComputer networks\nDatabases\nSoftware engineering',
    },
  }),
  prog({
    key: 'kiberxavfsizlik', code: '60611200', field: F.it, day: DAY_PLUS, dist: DIST_PLUS,
    title: { uz: 'Kiberxavfsizlik injiniringi', ru: 'Инженерия кибербезопасности', en: 'Cybersecurity Engineering' },
    intro: {
      uz: 'Axborot tizimlari, tarmoqlar va ma’lumotlarni tahdidlardan himoya qilish bo‘yicha muhandislik yo‘nalishi. Kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Инженерное направление по защите информационных систем, сетей и данных от угроз. Обучение очно и дистанционно.',
      en: 'An engineering programme on protecting information systems, networks and data from threats. Available full-time and by distance learning.',
    },
    hl: {
      uz: 'Tarmoq xavfsizligi\nKriptografiya asoslari\nOperatsion tizimlar xavfsizligi\nXavf-xatarlarni tahlil qilish va boshqarish\nAxborot xavfsizligi standartlari',
      ru: 'Сетевая безопасность\nОсновы криптографии\nБезопасность операционных систем\nАнализ и управление рисками\nСтандарты информационной безопасности',
      en: 'Network security\nFoundations of cryptography\nOperating system security\nRisk analysis and management\nInformation security standards',
    },
  }),
  prog({
    key: 'iqtisodiyot', code: '60410100', field: F.econ, day: DAY_PLUS, dist: DIST_PLUS, joint: FAQ_JOINT_BIZ,
    language: { uz: 'O‘zbek tili', ru: 'Узбекский', en: 'Uzbek' },
    title: { uz: 'Iqtisodiyot (o‘zbek tilida)', ru: 'Экономика (на узбекском языке)', en: 'Economics (taught in Uzbek)' },
    intro: {
      uz: 'Iqtisodiy jarayonlarni tahlil qilish, rejalashtirish va boshqarishga tayyorlovchi yo‘nalish. O‘zbek tilida, kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Направление готовит к анализу, планированию и управлению экономическими процессами. Обучение на узбекском языке, очно и дистанционно.',
      en: 'Prepares students to analyse, plan and manage economic processes. Taught in Uzbek, full-time and by distance learning.',
    },
    hl: {
      uz: 'Mikro- va makroiqtisodiyot\nEkonometrika va statistika\nMenejment va marketing asoslari\nXalqaro iqtisodiyot\nIqtisodiy tahlil',
      ru: 'Микро- и макроэкономика\nЭконометрика и статистика\nОсновы менеджмента и маркетинга\nМеждународная экономика\nЭкономический анализ',
      en: 'Micro- and macroeconomics\nEconometrics and statistics\nFoundations of management and marketing\nInternational economics\nEconomic analysis',
    },
  }),
  prog({
    key: 'iqtisodiyot-rus', code: '60410100', field: F.econ, day: DAY_PLUS, dist: DIST_PLUS, joint: FAQ_JOINT_BIZ,
    language: { uz: 'Rus tili', ru: 'Русский', en: 'Russian' },
    title: { uz: 'Iqtisodiyot (rus tilida)', ru: 'Экономика (на русском языке)', en: 'Economics (taught in Russian)' },
    intro: {
      uz: 'Iqtisodiyot yo‘nalishining rus tilidagi guruhi. Kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Группа направления «Экономика» с обучением на русском языке. Очная и дистанционная формы.',
      en: 'The Russian-language stream of the Economics programme. Full-time and distance learning.',
    },
    hl: {
      uz: 'Mikro- va makroiqtisodiyot\nEkonometrika va statistika\nMenejment va marketing asoslari\nXalqaro iqtisodiyot\nIqtisodiy tahlil',
      ru: 'Микро- и макроэкономика\nЭконометрика и статистика\nОсновы менеджмента и маркетинга\nМеждународная экономика\nЭкономический анализ',
      en: 'Micro- and macroeconomics\nEconometrics and statistics\nFoundations of management and marketing\nInternational economics\nEconomic analysis',
    },
  }),
  prog({
    key: 'moliya', code: '60410500', field: F.econ, day: DAY_PLUS, dist: DIST_PLUS, joint: FAQ_JOINT_BIZ,
    title: { uz: 'Moliya va moliyaviy texnologiyalar', ru: 'Финансы и финансовые технологии', en: 'Finance and Financial Technology' },
    intro: {
      uz: 'Moliya, bank ishi va raqamli moliyaviy xizmatlarni birlashtirgan yo‘nalish. Kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Направление, объединяющее финансы, банковское дело и цифровые финансовые сервисы. Очная и дистанционная формы.',
      en: 'A programme combining finance, banking and digital financial services. Full-time and distance learning.',
    },
    hl: {
      uz: 'Moliyaviy tahlil va hisobot\nBank ishi va investitsiyalar\nRaqamli to‘lovlar va FinTech\nMoliyaviy risklarni boshqarish\nSoliq va byudjet asoslari',
      ru: 'Финансовый анализ и отчётность\nБанковское дело и инвестиции\nЦифровые платежи и финтех\nУправление финансовыми рисками\nОсновы налогообложения и бюджета',
      en: 'Financial analysis and reporting\nBanking and investment\nDigital payments and FinTech\nFinancial risk management\nFoundations of tax and budgeting',
    },
  }),
  prog({
    key: 'turizm', code: '60010100', field: F.tour, day: DAY, joint: FAQ_JOINT_BIZ,
    title: { uz: 'Turizm va mehmondo‘stlik', ru: 'Туризм и гостеприимство', en: 'Tourism and Hospitality' },
    intro: {
      uz: 'Turizm industriyasi, mehmonxona va xizmat ko‘rsatish sohasi uchun mutaxassislar tayyorlaydigan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление готовит специалистов для туристической отрасли, гостиничного бизнеса и сферы услуг. Очная форма обучения.',
      en: 'Prepares specialists for the tourism industry, hotels and the service sector. Full-time study.',
    },
    hl: {
      uz: 'Turizm iqtisodiyoti va marketingi\nMehmonxona va restoran xizmati\nTuristik mahsulot va marshrutlar\nXalqaro turizm\nXorijiy tilda kommunikatsiya',
      ru: 'Экономика и маркетинг туризма\nГостиничный и ресторанный сервис\nТуристический продукт и маршруты\nМеждународный туризм\nКоммуникация на иностранном языке',
      en: 'Tourism economics and marketing\nHotel and restaurant services\nTourism products and itineraries\nInternational tourism\nCommunication in a foreign language',
    },
  }),
  prog({
    key: 'filologiya-ingliz', code: '60230100', field: F.lang, day: DAY,
    title: { uz: 'Filologiya va tillarni o‘qitish: ingliz tili', ru: 'Филология и преподавание языков: английский язык', en: 'Philology and Language Teaching: English' },
    intro: {
      uz: 'Ingliz tili, tilshunoslik va til o‘qitish metodikasini chuqur o‘rganadigan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление для углублённого изучения английского языка, лингвистики и методики преподавания. Очная форма.',
      en: 'In-depth study of the English language, linguistics and language teaching methods. Full-time study.',
    },
    hl: {
      uz: 'Amaliy ingliz tili\nTilshunoslik nazariyasi\nTarjima asoslari\nTil o‘qitish metodikasi\nAdabiyotshunoslik',
      ru: 'Практический английский язык\nТеория языкознания\nОсновы перевода\nМетодика преподавания языка\nЛитературоведение',
      en: 'Practical English\nLinguistic theory\nFoundations of translation\nLanguage teaching methods\nLiterary studies',
    },
  }),
  prog({
    key: 'filologiya-ozbek', code: '60230100', field: F.lang, day: DAY,
    title: { uz: 'Filologiya va tillarni o‘qitish: o‘zbek tili', ru: 'Филология и преподавание языков: узбекский язык', en: 'Philology and Language Teaching: Uzbek' },
    intro: {
      uz: 'O‘zbek tili, adabiyoti va uni o‘qitish metodikasiga ixtisoslashgan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление, специализирующееся на узбекском языке, литературе и методике их преподавания. Очная форма.',
      en: 'Specialises in the Uzbek language, literature and how to teach them. Full-time study.',
    },
    hl: {
      uz: 'Hozirgi o‘zbek adabiy tili\nO‘zbek adabiyoti tarixi\nTilshunoslik nazariyasi\nTil o‘qitish metodikasi\nMatn tahlili',
      ru: 'Современный узбекский литературный язык\nИстория узбекской литературы\nТеория языкознания\nМетодика преподавания языка\nАнализ текста',
      en: 'Modern literary Uzbek\nHistory of Uzbek literature\nLinguistic theory\nLanguage teaching methods\nText analysis',
    },
  }),
  prog({
    key: 'filologiya-rus', code: '60230100', field: F.lang, day: DAY,
    title: { uz: 'Filologiya va tillarni o‘qitish: rus tili', ru: 'Филология и преподавание языков: русский язык', en: 'Philology and Language Teaching: Russian' },
    intro: {
      uz: 'Rus tili, adabiyoti va uni o‘qitish metodikasiga ixtisoslashgan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление, специализирующееся на русском языке, литературе и методике их преподавания. Очная форма.',
      en: 'Specialises in the Russian language, literature and how to teach them. Full-time study.',
    },
    hl: {
      uz: 'Hozirgi rus tili\nRus adabiyoti\nTilshunoslik nazariyasi\nTil o‘qitish metodikasi\nTarjima asoslari',
      ru: 'Современный русский язык\nРусская литература\nТеория языкознания\nМетодика преподавания языка\nОсновы перевода',
      en: 'Modern Russian\nRussian literature\nLinguistic theory\nLanguage teaching methods\nFoundations of translation',
    },
  }),
  prog({
    key: 'xorijiy-til', code: '60110900', field: F.lang, day: DAY,
    title: { uz: 'Xorijiy til va adabiyoti: ingliz tili', ru: 'Иностранный язык и литература: английский язык', en: 'Foreign Language and Literature: English' },
    intro: {
      uz: 'Ingliz tili va adabiyoti o‘qituvchilarini tayyorlaydigan pedagogik yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Педагогическое направление, готовящее преподавателей английского языка и литературы. Очная форма.',
      en: 'A teacher-education programme for English language and literature teachers. Full-time study.',
    },
    hl: {
      uz: 'Amaliy ingliz tili\nIngliz va amerika adabiyoti\nXorijiy tillarni o‘qitish metodikasi\nPedagogika va psixologiya\nPedagogik amaliyot',
      ru: 'Практический английский язык\nАнглийская и американская литература\nМетодика преподавания иностранных языков\nПедагогика и психология\nПедагогическая практика',
      en: 'Practical English\nBritish and American literature\nForeign language teaching methods\nPedagogy and psychology\nTeaching practice',
    },
  }),
  prog({
    key: 'boshlangich-talim', code: '60110400', field: F.edu, day: DAY,
    title: { uz: 'Boshlang‘ich ta’lim', ru: 'Начальное образование', en: 'Primary Education' },
    intro: {
      uz: 'Boshlang‘ich sinf o‘qituvchilarini tayyorlaydigan pedagogik yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Педагогическое направление, готовящее учителей начальных классов. Очная форма.',
      en: 'A teacher-education programme for primary school teachers. Full-time study.',
    },
    hl: {
      uz: 'Boshlang‘ich ta’lim pedagogikasi\nBolalar psixologiyasi\nOna tili va o‘qish metodikasi\nMatematika o‘qitish metodikasi\nPedagogik amaliyot',
      ru: 'Педагогика начального образования\nДетская психология\nМетодика родного языка и чтения\nМетодика преподавания математики\nПедагогическая практика',
      en: 'Primary education pedagogy\nChild psychology\nMethods of teaching native language and reading\nMethods of teaching mathematics\nTeaching practice',
    },
  }),
  prog({
    key: 'maktabgacha-talim', code: '60110200', field: F.edu, day: DAY,
    title: { uz: 'Maktabgacha ta’lim', ru: 'Дошкольное образование', en: 'Preschool Education' },
    intro: {
      uz: 'Maktabgacha ta’lim tashkilotlari uchun tarbiyachi va mutaxassislar tayyorlaydigan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление готовит воспитателей и специалистов для дошкольных образовательных организаций. Очная форма.',
      en: 'Prepares educators and specialists for preschool institutions. Full-time study.',
    },
    hl: {
      uz: 'Maktabgacha pedagogika\nBola rivojlanishi psixologiyasi\nO‘yin va ijodiy faoliyat metodikasi\nNutq o‘stirish\nPedagogik amaliyot',
      ru: 'Дошкольная педагогика\nПсихология развития ребёнка\nМетодика игровой и творческой деятельности\nРазвитие речи\nПедагогическая практика',
      en: 'Preschool pedagogy\nChild development psychology\nMethods of play and creative activities\nSpeech development\nTeaching practice',
    },
  }),
  prog({
    key: 'maxsus-pedagogika', code: '60110300', field: F.edu, day: DAY,
    title: { uz: 'Maxsus pedagogika', ru: 'Специальная педагогика', en: 'Special Education' },
    intro: {
      uz: 'Alohida ta’lim ehtiyojlari bo‘lgan bolalar bilan ishlaydigan mutaxassislarni tayyorlaydigan yo‘nalish. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Направление готовит специалистов для работы с детьми с особыми образовательными потребностями. Очная форма.',
      en: 'Prepares specialists to work with children with special educational needs. Full-time study.',
    },
    hl: {
      uz: 'Maxsus pedagogika asoslari\nInklyuziv ta’lim\nLogopediya asoslari\nMaxsus psixologiya\nPedagogik amaliyot',
      ru: 'Основы специальной педагогики\nИнклюзивное образование\nОсновы логопедии\nСпециальная психология\nПедагогическая практика',
      en: 'Foundations of special education\nInclusive education\nFoundations of speech therapy\nSpecial psychology\nTeaching practice',
    },
  }),
  prog({
    key: 'psixologiya', code: '60310300', field: F.soc, day: DAY, dist: DIST,
    title: { uz: 'Psixologiya', ru: 'Психология', en: 'Psychology' },
    intro: {
      uz: 'Inson psixikasi, xulq-atvori va psixologik yordam asoslarini o‘rganadigan yo‘nalish. Kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Направление изучает психику, поведение человека и основы психологической помощи. Очная и дистанционная формы.',
      en: 'Studies the human mind, behaviour and the foundations of psychological support. Full-time and distance learning.',
    },
    hl: {
      uz: 'Umumiy psixologiya\nYosh davrlari psixologiyasi\nIjtimoiy psixologiya\nPsixodiagnostika\nPsixologik maslahat asoslari',
      ru: 'Общая психология\nВозрастная психология\nСоциальная психология\nПсиходиагностика\nОсновы психологического консультирования',
      en: 'General psychology\nDevelopmental psychology\nSocial psychology\nPsychological assessment\nFoundations of counselling',
    },
  }),
  prog({
    key: 'tarix', code: '60220300', field: F.soc, day: DAY, dist: DIST,
    title: { uz: 'Tarix', ru: 'История', en: 'History' },
    intro: {
      uz: 'O‘zbekiston va jahon tarixini, tarixiy manbalar bilan ishlashni o‘rganadigan yo‘nalish. Kunduzgi va masofaviy shakllarda o‘qitiladi.',
      ru: 'Направление изучает историю Узбекистана и мира, работу с историческими источниками. Очная и дистанционная формы.',
      en: 'Studies the history of Uzbekistan and the world and how to work with historical sources. Full-time and distance learning.',
    },
    hl: {
      uz: 'O‘zbekiston tarixi\nJahon tarixi\nManbashunoslik\nArxeologiya va etnografiya asoslari\nTarix o‘qitish metodikasi',
      ru: 'История Узбекистана\nВсемирная история\nИсточниковедение\nОсновы археологии и этнографии\nМетодика преподавания истории',
      en: 'History of Uzbekistan\nWorld history\nSource studies\nFoundations of archaeology and ethnography\nHistory teaching methods',
    },
  }),
  prog({
    key: 'mag-iqtisodiyot', level: 'magistratura', code: '70410102', field: F.econ, day: MASTER,
    title: { uz: 'Iqtisodiyot (magistratura)', ru: 'Экономика (магистратура)', en: 'Economics (Master’s)' },
    intro: {
      uz: 'Iqtisodiyot bo‘yicha chuqurlashtirilgan bilim va ilmiy-tadqiqot ko‘nikmalarini beradigan magistratura mutaxassisligi. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Магистерская специальность с углублёнными знаниями в экономике и навыками научных исследований. Очная форма.',
      en: 'A master’s programme offering advanced knowledge of economics and research skills. Full-time study.',
    },
    hl: {
      uz: 'Ilg‘or makroiqtisodiy tahlil\nEkonometrik modellashtirish\nIlmiy tadqiqot metodologiyasi\nIqtisodiy siyosat\nMagistrlik dissertatsiyasi',
      ru: 'Продвинутый макроэкономический анализ\nЭконометрическое моделирование\nМетодология научных исследований\nЭкономическая политика\nМагистерская диссертация',
      en: 'Advanced macroeconomic analysis\nEconometric modelling\nResearch methodology\nEconomic policy\nMaster’s thesis',
    },
  }),
  prog({
    key: 'mag-lingvistika', level: 'magistratura', code: '70230101', field: F.lang, day: MASTER,
    title: { uz: 'Lingvistika (magistratura)', ru: 'Лингвистика (магистратура)', en: 'Linguistics (Master’s)' },
    intro: {
      uz: 'Tilshunoslik nazariyasi va amaliyoti bo‘yicha chuqurlashtirilgan bilim beradigan magistratura mutaxassisligi. Kunduzgi shaklda o‘qitiladi.',
      ru: 'Магистерская специальность с углублёнными знаниями теории и практики языкознания. Очная форма.',
      en: 'A master’s programme offering advanced knowledge of linguistic theory and practice. Full-time study.',
    },
    hl: {
      uz: 'Zamonaviy lingvistik nazariyalar\nKorpus lingvistikasi\nQiyosiy tilshunoslik\nIlmiy tadqiqot metodologiyasi\nMagistrlik dissertatsiyasi',
      ru: 'Современные лингвистические теории\nКорпусная лингвистика\nСравнительное языкознание\nМетодология научных исследований\nМагистерская диссертация',
      en: 'Contemporary linguistic theories\nCorpus linguistics\nComparative linguistics\nResearch methodology\nMaster’s thesis',
    },
  }),
];

/* ============================ STARTAPLAR (Natijalar) ============================ */
function st(name, award, meta, desc) {
  return {
    name, subtitle: award.uz, image: '', description: `${meta.uz}\n${desc.uz}`,
    i18n: { ru: { subtitle: award.ru, description: `${meta.ru}\n${desc.ru}` }, en: { subtitle: award.en, description: `${meta.en}\n${desc.en}` } },
  };
}
const UNI1 = { uz: '«Startap loyihalar» tanlovi, universitet bosqichi — 1-o‘rin', ru: 'Конкурс «Стартап-проекты», университетский этап — 1-е место', en: '“Startup Projects” competition, university round — 1st place' };
const UNI2 = { uz: '«Startap loyihalar» tanlovi, universitet bosqichi — 2-o‘rin', ru: 'Конкурс «Стартап-проекты», университетский этап — 2-е место', en: '“Startup Projects” competition, university round — 2nd place' };
const UNI3 = { uz: '«Startap loyihalar» tanlovi, universitet bosqichi — 3-o‘rin', ru: 'Конкурс «Стартап-проекты», университетский этап — 3-е место', en: '“Startup Projects” competition, university round — 3rd place' };
const IDEA1 = { uz: '«Eng yaxshi kreativ g‘oya» tanlovi, universitet bosqichi — 1-o‘rin', ru: 'Конкурс «Лучшая креативная идея», университетский этап — 1-е место', en: '“Best Creative Idea” competition, university round — 1st place' };
const IDEA2 = { uz: '«Eng yaxshi kreativ g‘oya» tanlovi, universitet bosqichi — 2-o‘rin', ru: 'Конкурс «Лучшая креативная идея», университетский этап — 2-е место', en: '“Best Creative Idea” competition, university round — 2nd place' };
const IDEA3 = { uz: '«Eng yaxshi kreativ g‘oya» tanlovi, universitet bosqichi — 3-o‘rin', ru: 'Конкурс «Лучшая креативная идея», университетский этап — 3-е место', en: '“Best Creative Idea” competition, university round — 3rd place' };
const M = {
  social: { uz: 'Ijtimoiy startap · Prototip', ru: 'Социальный стартап · Прототип', en: 'Social startup · Prototype' },
  edtech: { uz: 'EdTech · Prototip', ru: 'EdTech · Прототип', en: 'EdTech · Prototype' },
  med: { uz: 'Tibbiyot · Prototip', ru: 'Медицина · Прототип', en: 'Healthcare · Prototype' },
  edtech0: { uz: 'EdTech · Talabalar loyihasi', ru: 'EdTech · Студенческий проект', en: 'EdTech · Student project' },
  it: { uz: 'IT · Talabalar loyihasi', ru: 'IT · Студенческий проект', en: 'IT · Student project' },
  tour: { uz: 'Turizm · Talabalar loyihasi', ru: 'Туризм · Студенческий проект', en: 'Tourism · Student project' },
  social0: { uz: 'Ijtimoiy · Talabalar loyihasi', ru: 'Социальный · Студенческий проект', en: 'Social · Student project' },
  innov: { uz: 'Innovatsiya · Talabalar loyihasi', ru: 'Инновации · Студенческий проект', en: 'Innovation · Student project' },
  eco: { uz: 'Ekologiya · Talabalar loyihasi', ru: 'Экология · Студенческий проект', en: 'Ecology · Student project' },
};
const D_GENERIC = (field) => ({
  uz: `${field.uz} yo‘nalishidagi talabalar startap loyihasi.`,
  ru: `Студенческий стартап-проект в области «${field.ru}».`,
  en: `A student startup project in ${field.en}.`,
});
const ACHIEVEMENTS = [
  st('Mehrli qadam',
    { uz: '«Mirzo Ulug‘bek vorislari» tanlovi respublika bosqichi g‘olibi', ru: 'Победитель республиканского этапа конкурса «Мирзо Улугбек ворислари»', en: 'National-round winner of the “Mirzo Ulugbek Vorislari” competition' },
    M.social,
    { uz: 'Autizmli bolalarning ijtimoiy va muloqot ko‘nikmalarini rivojlantirishga qaratilgan platforma.', ru: 'Платформа для развития социальных и коммуникативных навыков у детей с аутизмом.', en: 'A platform that helps children with autism develop social and communication skills.' }),
  st('ZenithLearn',
    { uz: 'Hult Prize: universitet bosqichida 1-o‘rin, respublika bosqichida eng kuchli 10 talikda', ru: 'Hult Prize: 1-е место на университетском этапе, топ-10 на республиканском этапе', en: 'Hult Prize: 1st place in the university round, top 10 nationally' },
    M.edtech,
    { uz: 'Affective computing texnologiyasi yordamida bolalarning hissiy intellektini rivojlantiruvchi sun’iy intellekt ekotizimi.', ru: 'Экосистема искусственного интеллекта, развивающая эмоциональный интеллект детей с помощью технологии affective computing.', en: 'An AI ecosystem that develops children’s emotional intelligence using affective computing.' }),
  st('Kasallikni erta aniqlash',
    { uz: 'Umummilliy AI Hackathon, «Ta’lim» yo‘nalishi — 3-o‘rin', ru: 'Национальный AI Hackathon, направление «Образование» — 3-е место', en: 'National AI Hackathon, “Education” track — 3rd place' },
    M.med,
    { uz: 'Sun’iy intellekt yordamida kasallikni erta bosqichda aniqlashga qaratilgan loyiha.', ru: 'Проект по выявлению заболеваний на ранней стадии с помощью искусственного интеллекта.', en: 'A project using artificial intelligence to detect diseases at an early stage.' }),
  st('ZENITH', UNI1, M.edtech0, { uz: 'Talabalar tomonidan ishlab chiqilgan innovatsion ta’lim loyihasi.', ru: 'Инновационный образовательный проект, разработанный студентами.', en: 'An innovative education project developed by students.' }),
  st('VISION CART', UNI2, M.it, D_GENERIC({ uz: 'Axborot texnologiyalari', ru: 'информационные технологии', en: 'information technology' })),
  st('UZBEK TOUR', UNI3, M.tour, D_GENERIC({ uz: 'Turizm', ru: 'туризм', en: 'tourism' })),
  st('Inclusive edu', IDEA1, M.social0, D_GENERIC({ uz: 'Ijtimoiy', ru: 'социальная сфера', en: 'the social sector' })),
  st('Smart Kitobxon', IDEA2, M.edtech0, D_GENERIC({ uz: 'Ta’lim texnologiyalari', ru: 'образовательные технологии', en: 'education technology' })),
  st('Adelphi', IDEA2, M.innov, D_GENERIC({ uz: 'Innovatsiya', ru: 'инновации', en: 'innovation' })),
  st('SolarDrive', IDEA3, M.eco, D_GENERIC({ uz: 'Ekologiya', ru: 'экология', en: 'ecology' })),
  st('Ecorobot',
    { uz: '«Eng yaxshi kreativ g‘oya» — 3-o‘rin; «Mirzo Ulug‘bek vorislari» viloyat bosqichi ishtirokchisi', ru: '«Лучшая креативная идея» — 3-е место; участник областного этапа «Мирзо Улугбек ворислари»', en: '“Best Creative Idea” — 3rd place; regional-round participant of “Mirzo Ulugbek Vorislari”' },
    M.eco, D_GENERIC({ uz: 'Ekologiya', ru: 'экология', en: 'ecology' })),
  st('Ecosiftly', IDEA3, M.eco, D_GENERIC({ uz: 'Ekologiya', ru: 'экология', en: 'ecology' })),
];

/* ============================ AJRALIB TURISH ============================ */
function tri(uz, ru, en) { return { uz, ru, en }; }
function row3(fields) {
  const out = { i18n: { ru: {}, en: {} } };
  for (const [k, val] of Object.entries(fields)) {
    if (val && typeof val === 'object' && 'uz' in val) { out[k] = val.uz; out.i18n.ru[k] = val.ru; out.i18n.en[k] = val.en; } else out[k] = val;
  }
  return out;
}
const DISTINCTIONS = [
  row3({
    title: tri('Farg‘ona viloyatidagi birinchi nodavlat universitet', 'Первый негосударственный университет Ферганской области', 'The first private university in the Fergana region'),
    image: '',
    summary: tri('2019-yildan buyon zamonaviy ta’lim modeli va davlat litsenziyasi.', 'С 2019 года — современная модель обучения и государственная лицензия.', 'A modern education model and a state licence since 2019.'),
    body: tri('Kokand University O‘zbekiston Respublikasi Vazirlar Mahkamasining 2019-yil 17-avgustdagi 683-son qarori asosida tashkil etilgan. Universitet diplomlari O‘zbekistonda oliy ma’lumot to‘g‘risidagi davlat hujjati sifatida tan olinadi.',
      'Kokand University основан на основании постановления Кабинета Министров Республики Узбекистан № 683 от 17 августа 2019 года. Дипломы университета признаются в Узбекистане государственным документом о высшем образовании.',
      'Kokand University was established by Resolution No. 683 of the Cabinet of Ministers of Uzbekistan of 17 August 2019. Its diplomas are recognised in Uzbekistan as official state higher education credentials.'),
  }),
  row3({
    title: tri('Ikki yil Qo‘qonda, ikki yil xorijda', 'Два года в Коканде, два года за рубежом', 'Two years in Kokand, two years abroad'),
    image: '',
    summary: tri('SolBridge, Woosong, Joongbu (Janubiy Koreya) va TSI (Latviya) bilan qo‘shma dasturlar.', 'Совместные программы с SolBridge, Woosong, Joongbu (Южная Корея) и TSI (Латвия).', 'Joint programmes with SolBridge, Woosong, Joongbu (South Korea) and TSI (Latvia).'),
    body: tri('Talabalar 4-semestrda ariza topshirib, o‘qishni hamkor universitetda ikki yil davom ettiradi. Talablar: GPA kamida 3.37 va IELTS 6.0+ (Joongbu University uchun TOPIK 3).',
      'Студенты подают заявку на 4-м семестре и продолжают обучение два года в университете-партнёре. Требования: GPA не ниже 3.37 и IELTS 6.0+ (для Joongbu University — TOPIK 3).',
      'Students apply in their 4th semester and spend two years at a partner university. Requirements: GPA of at least 3.37 and IELTS 6.0+ (TOPIK 3 for Joongbu University).'),
  }),
  row3({
    title: tri('Startaplar ekotizimi', 'Экосистема стартапов', 'A startup ecosystem'),
    image: '',
    summary: tri('Talabalar loyihalari respublika va xalqaro tanlovlarda sovrindor.', 'Студенческие проекты побеждают на республиканских и международных конкурсах.', 'Student projects win national and international competitions.'),
    body: tri('“Mehrli qadam” — «Mirzo Ulug‘bek vorislari» respublika bosqichi g‘olibi, ZenithLearn — Hult Prize respublika bosqichida eng kuchli 10 talikda, “Kasallikni erta aniqlash” — Umummilliy AI Hackathon sovrindori. Universitetda startap va innovatsion tadbirkorlikni rivojlantirish departamenti ishlaydi.',
      '«Mehrli qadam» — победитель республиканского этапа «Мирзо Улугбек ворислари», ZenithLearn — в топ-10 республиканского этапа Hult Prize, «Раннее выявление заболеваний» — призёр Национального AI Hackathon. В университете работает департамент развития стартапов и инновационного предпринимательства.',
      '“Mehrli qadam” won the national round of “Mirzo Ulugbek Vorislari”, ZenithLearn reached the national top 10 of the Hult Prize, and “Early Disease Detection” placed at the National AI Hackathon. The university has a dedicated department for startups and innovative entrepreneurship.'),
  }),
  row3({
    title: tri('Raqamli kampus', 'Цифровой кампус', 'A digital campus'),
    image: '',
    summary: tri('HEMIS, elektron kutubxona, masofaviy ta’lim va korporativ pochta.', 'HEMIS, электронная библиотека, дистанционное обучение и корпоративная почта.', 'HEMIS, an e-library, distance learning and corporate email.'),
    body: tri('Talaba va o‘qituvchilar HEMIS axborot tizimi, elektron kutubxona va korporativ pochtadan foydalanadi. Ko‘plab yo‘nalishlar masofaviy shaklda ham o‘qitiladi, rektorga murojaat Telegram bot orqali yuboriladi.',
      'Студенты и преподаватели пользуются информационной системой HEMIS, электронной библиотекой и корпоративной почтой. Многие направления доступны дистанционно, а обращение к ректору можно отправить через Telegram-бот.',
      'Students and staff use the HEMIS information system, an e-library and corporate email. Many programmes are also available by distance learning, and messages to the rector can be sent via a Telegram bot.'),
  }),
  row3({
    title: tri('Ilm-fan va doktorantura', 'Наука и докторантура', 'Research and doctoral studies'),
    image: '',
    summary: tri('31 doktorant, 88 mustaqil tadqiqotchi va universitetning o‘z ilmiy jurnali.', '31 докторант, 88 независимых исследователей и собственный научный журнал.', '31 doctoral students, 88 independent researchers and the university’s own journal.'),
    body: tri('Universitet doktorantura bosqichida tadqiqotchilar tayyorlaydi, ilmiy natijalar Kokand University Herald jurnali va ilmiy maqolalar platformasida e’lon qilinadi. Strategik maqsad — Scopus va Web of Science jurnallaridagi nashrlarni ko‘paytirish.',
      'Университет готовит исследователей в докторантуре, результаты публикуются в журнале Kokand University Herald и на платформе научных статей. Стратегическая цель — рост публикаций в журналах Scopus и Web of Science.',
      'The university trains researchers at the doctoral level; results are published in the Kokand University Herald and on its research platform. A strategic goal is to grow publications in Scopus and Web of Science journals.'),
  }),
  row3({
    title: tri('Uch fakultet — 14 ta’lim yo‘nalishi', 'Три факультета — 14 направлений', 'Three faculties — 14 programmes'),
    image: '',
    summary: tri('Iqtisodiyot va turizmdan IT, pedagogika va filologiyagacha.', 'От экономики и туризма до IT, педагогики и филологии.', 'From economics and tourism to IT, education and philology.'),
    body: tri('Turizm va iqtisodiyot, Jahon tillari va filologiya hamda Ta’lim fakultetlarida bakalavriat va magistratura dasturlari, kunduzgi va masofaviy shakllarda.',
      'На факультетах туризма и экономики, мировых языков и филологии, а также образования — программы бакалавриата и магистратуры в очной и дистанционной формах.',
      'The Faculties of Tourism and Economics, World Languages and Philology, and Education offer bachelor’s and master’s programmes, full-time and by distance learning.'),
  }),
];

/* ============================ FOYDALI HAVOLALAR ============================ */
const INTERESTS = [
  row3({ title: tri('Abituriyentlarga', 'Абитуриентам', 'For applicants'), image: '', body: tri('Qabul shartlari va muddatlari, hujjat topshirish tartibi, kontrakt va grant imkoniyatlari.', 'Условия и сроки приёма, порядок подачи документов, контракт и гранты.', 'Admission requirements and deadlines, how to apply, tuition and grants.'), link: `${OFFICIAL}/uz/static/for-applicants` }),
  row3({ title: tri('Talabalarga', 'Студентам', 'For students'), image: '', body: tri('Dars jadvallari, yakuniy attestatsiya va o‘quv resurslari.', 'Расписания занятий, итоговая аттестация и учебные ресурсы.', 'Class timetables, final assessment and learning resources.'), link: `${OFFICIAL}/uz/static/for-students` }),
  row3({ title: tri('Ota-onalarga', 'Родителям', 'For parents'), image: '', body: tri('Ota-onalar uchun foydali ma’lumotlar.', 'Полезная информация для родителей.', 'Useful information for parents.'), link: `${OFFICIAL}/uz/static/parents` }),
  row3({ title: tri('Bitiruvchilar', 'Выпускники', 'Alumni'), image: '', body: tri('Kokand University bitiruvchilari hamjamiyati.', 'Сообщество выпускников Kokand University.', 'The Kokand University alumni community.'), link: `${OFFICIAL}/uz/alumnis` }),
  row3({ title: tri('Vakansiyalar', 'Вакансии', 'Careers'), image: '', body: tri('Universitetdagi bo‘sh ish o‘rinlari.', 'Открытые вакансии университета.', 'Open positions at the university.'), link: 'https://hrd.kokanduni.uz' }),
  row3({ title: tri('Ilmiy jurnal', 'Научный журнал', 'Research journal'), image: '', body: tri('Kokand University Herald — universitetning ilmiy jurnali.', 'Kokand University Herald — научный журнал университета.', 'Kokand University Herald — the university’s research journal.'), link: 'https://herald.kokanduni.uz/index.php/public_html' }),
];

/* ============================ YANGILIKLAR ============================ */
const NEWS = [
  row3({
    title: tri('Xalqaro aloqalar: Ozarbayjon', 'Международные связи: Азербайджан', 'International relations: Azerbaijan'),
    date: '02.10.2026', image: '',
    excerpt: tri('Xalqaro turizm va iqtisodiyot kafedrasi vakillari Ozarbayjondagi xalqaro konferensiyada ishtirok etib, hamkorlik imkoniyatlarini muhokama qildi.', 'Представители кафедры международного туризма и экономики приняли участие в международной конференции в Азербайджане и обсудили возможности сотрудничества.', 'Faculty from the Department of International Tourism and Economics attended an international conference in Azerbaijan and discussed opportunities for cooperation.'),
    body: tri('Kokand University Xalqaro turizm va iqtisodiyot kafedrasi mudiri va dotsenti Ozarbayjon Respublikasida o‘tkazilgan xalqaro konferensiyada ishtirok etdi.\n\nOzarbayjon Arxitektura va qurilish universiteti vakillari bilan uchrashuvda qo‘shma ilmiy loyihalar, akademik mobillik, professor-o‘qituvchi va talabalar almashinuvi hamda kelgusidagi hamkorlik yo‘nalishlari muhokama qilindi.',
      'Заведующий и доцент кафедры международного туризма и экономики Kokand University приняли участие в международной конференции в Азербайджанской Республике.\n\nНа встрече с представителями Азербайджанского архитектурно-строительного университета обсуждались совместные научные проекты, академическая мобильность, обмен преподавателями и студентами, а также дальнейшие направления сотрудничества.',
      'The head and an associate professor of Kokand University’s Department of International Tourism and Economics took part in an international conference in the Republic of Azerbaijan.\n\nAt a meeting with Azerbaijan University of Architecture and Construction, the sides discussed joint research projects, academic mobility, staff and student exchanges and future areas of cooperation.'),
    link: `${OFFICIAL}/uz/blog/show/xalqaro-aloqalar-ozarbayjon`,
  }),
  row3({
    title: tri('“Jaholatga qarshi ma’rifat” mavzusida ma’naviy-ma’rifiy uchrashuv', 'Просветительская встреча «Просвещение против невежества»', '“Enlightenment against ignorance” educational meeting'),
    date: '02.10.2026', image: '',
    excerpt: tri('Talabalarning ma’naviy dunyoqarashini kengaytirish va mafkuraviy immunitetini mustahkamlash maqsadida uchrashuv o‘tkazildi.', 'Встреча прошла с целью расширить мировоззрение студентов и укрепить их идеологический иммунитет.', 'A meeting was held to broaden students’ outlook and strengthen their resilience to harmful ideas.'),
    body: tri('Universitetda “Jaholatga qarshi ma’rifat” mavzusida ma’naviy-ma’rifiy uchrashuv bo‘lib o‘tdi.\n\nTadbirda jaholatning salbiy oqibatlari va ma’rifat orqali yot g‘oyalarga qarshi kurashishning ahamiyati haqida ma’ruzalar tinglandi.',
      'В университете прошла просветительская встреча «Просвещение против невежества».\n\nВыступающие говорили о негативных последствиях невежества и о значении просвещения в противостоянии чуждым идеям.',
      'The university hosted an educational meeting titled “Enlightenment against ignorance”.\n\nSpeakers discussed the harmful effects of ignorance and the importance of education in countering harmful ideas.'),
    link: `${OFFICIAL}/uz/blog/show/jaholatga-qarshi-marifat-mavzusida-manaviy-marifiy-uchrashuv`,
  }),
  row3({
    title: tri('1-oktabr — O‘qituvchi va murabbiylar kuni', '1 октября — День учителя и наставника', '1 October — Teachers’ and Mentors’ Day'),
    date: '30.09.2026', image: '',
    excerpt: tri('Talabalar professor-o‘qituvchilarni O‘qituvchi va murabbiylar kuni bilan tabrikladi.', 'Студенты поздравили преподавателей с Днём учителя и наставника.', 'Students congratulated the teaching staff on Teachers’ and Mentors’ Day.'),
    body: tri('1-oktabr — O‘qituvchi va murabbiylar kuni munosabati bilan universitet talabalari professor-o‘qituvchilarni tantanali kutib oldi.\n\nUstozlarga bayram tabriklari va samimiy tilaklar bildirilib, ularning sharafli mehnatiga hurmat izhor etildi.',
      'По случаю Дня учителя и наставника 1 октября студенты университета торжественно встретили преподавателей.\n\nНаставникам прозвучали поздравления и тёплые пожелания, студенты выразили уважение их благородному труду.',
      'To mark Teachers’ and Mentors’ Day on 1 October, students gave the teaching staff a festive welcome.\n\nThey offered congratulations and warm wishes and expressed their respect for their teachers’ work.'),
    link: `${OFFICIAL}/uz/blog/show/1-oktabr-oqituvchi-va-murabbiylar-kuni-1`,
  }),
  row3({
    title: tri('“IT Queens — Kelajakni yaratuvchi qizlar” startap tanloviga start berildi', 'Стартовал конкурс стартапов «IT Queens — девушки, создающие будущее»', '“IT Queens — Girls Creating the Future” startup contest launched'),
    date: '29.09.2026', image: '',
    excerpt: tri('Kunduzgi ta’lim talaba-qizlari IT va mexatronika yo‘nalishidagi loyihalari bilan ishtirok etishi mumkin.', 'Студентки очной формы могут участвовать с проектами в области IT и мехатроники.', 'Full-time female students can take part with IT and mechatronics projects.'),
    body: tri('Oliy ta’lim, fan va innovatsiyalar vazirligi tashabbusi bilan “IT Queens — Kelajakni yaratuvchi qizlar” respublika startap ko‘rik-tanlovi tashkil etilmoqda.\n\nUniversitetning kunduzgi ta’lim talaba-qizlari axborot texnologiyalari va mexatronika yo‘nalishlaridagi loyihalarini taqdim etishi mumkin. Universitet bosqichi g‘oliblari Farg‘ona viloyati hududiy bosqichiga yo‘llanma oladi.',
      'По инициативе Министерства высшего образования, науки и инноваций проводится республиканский конкурс стартапов «IT Queens — девушки, создающие будущее».\n\nСтудентки очной формы обучения могут представить проекты в области информационных технологий и мехатроники. Победители университетского этапа выйдут на региональный этап Ферганской области.',
      'The Ministry of Higher Education, Science and Innovation has launched the national “IT Queens — Girls Creating the Future” startup contest.\n\nFull-time female students can present projects in information technology and mechatronics. Winners of the university round advance to the Fergana regional round.'),
    link: `${OFFICIAL}/uz/blog/show/it-queens-kelajakni-yaratuvchi-qizlar-startap-korik-tanloviga-start-berilmoqda`,
  }),
  row3({
    title: tri('Xalqaro aloqalar: Qirg‘iziston', 'Международные связи: Кыргызстан', 'International relations: Kyrgyzstan'),
    date: '29.09.2026', image: '',
    excerpt: tri('Raqamli texnologiyalar va matematika kafedrasi o‘qituvchilari akademik mobillik dasturi doirasida Qirg‘izistonda dars o‘tdi.', 'Преподаватели кафедры цифровых технологий и математики провели занятия в Кыргызстане по программе академической мобильности.', 'Lecturers from the Department of Digital Technologies and Mathematics taught in Kyrgyzstan under an academic mobility programme.'),
    body: tri('Universitetning Raqamli texnologiyalar va matematika kafedrasi professor-o‘qituvchilari akademik mobillik dasturi doirasida Qirg‘iziston xalqaro universitetida 18 soatlik mashg‘ulotlar o‘tkazdi.\n\nShuningdek, Kokand University va Qirg‘iziston xalqaro universitetining Politexnika kolleji o‘rtasida memorandum imzolandi.',
      'Преподаватели кафедры цифровых технологий и математики провели 18 часов занятий в Международном университете Кыргызстана в рамках программы академической мобильности.\n\nТакже был подписан меморандум между Kokand University и Политехническим колледжем Международного университета Кыргызстана.',
      'Lecturers from the Department of Digital Technologies and Mathematics delivered 18 hours of classes at the International University of Kyrgyzstan under an academic mobility programme.\n\nKokand University also signed a memorandum with the university’s Polytechnic College.'),
    link: `${OFFICIAL}/uz/blog/show/xalqaro-aloqalar-qirgiziston-1`,
  }),
  row3({
    title: tri('Umummilliy AI Hackathon: Farg‘ona', 'Национальный AI Hackathon: Фергана', 'National AI Hackathon: Fergana'),
    date: '23.05.2026', image: '/img/ku/ai-hackathon.jpg',
    excerpt: tri('Kokand University talabalari jamoasi Farg‘onada o‘tkazilgan Umummilliy AI Hackathon’da ishtirok etdi.', 'Команда студентов Kokand University приняла участие в Национальном AI Hackathon в Фергане.', 'A team of Kokand University students took part in the National AI Hackathon in Fergana.'),
    body: tri('Farg‘onada 2026-yil 20–23-may kunlari Umummilliy AI Hackathon bo‘lib o‘tdi, unda Kokand University talabalari jamoasi ham ishtirok etdi.\n\nHakaton davomida jamoalar jamiyat va kelajak uchun muhim yo‘nalishlarda sun’iy intellekt yechimlari ustida ishladi va loyihalarini mentorlar hamda ekspertlarga taqdim etdi.',
      'В Фергане 20–23 мая 2026 года прошёл Национальный AI Hackathon, в котором участвовала и команда студентов Kokand University.\n\nВ ходе хакатона команды работали над решениями на основе искусственного интеллекта для важных общественных задач и представили проекты менторам и экспертам.',
      'The National AI Hackathon took place in Fergana on 20–23 May 2026, and a team of Kokand University students took part.\n\nDuring the hackathon, teams built AI solutions for important social challenges and presented their projects to mentors and experts.'),
    link: 'https://t.me/kuyoshlarittifoqi',
  }),
];

/* ============================ HIKOYALAR ============================ */
const STORIES = [
  row3({
    title: tri('“Mehrli qadam”: autizmli bolalar uchun platforma', '«Mehrli qadam»: платформа для детей с аутизмом', '“Mehrli qadam”: a platform for children with autism'),
    date: '', category: tri('Startap', 'Стартап', 'Startup'), image: '',
    excerpt: tri('Talabalar jamoasining ijtimoiy loyihasi «Mirzo Ulug‘bek vorislari» tanlovining respublika bosqichida g‘olib bo‘ldi.', 'Социальный проект студенческой команды победил на республиканском этапе конкурса «Мирзо Улугбек ворислари».', 'A student team’s social project won the national round of the “Mirzo Ulugbek Vorislari” competition.'),
    body: tri('“Mehrli qadam” — autizmli bolalarning ijtimoiy va muloqot ko‘nikmalarini rivojlantirishga qaratilgan platforma. Loyiha hozir prototip bosqichida.\n\nJamoa tarkibida Kompyuter injiniringi yo‘nalishi talabasi ham bor. Loyiha «Mirzo Ulug‘bek vorislari» tanlovining respublika bosqichida g‘olib deb topildi.\n\nLoyiha haqida batafsil ma’lumot universitetning rasmiy saytidagi “Startaplar” bo‘limida e’lon qilingan.',
      '«Mehrli qadam» — платформа для развития социальных и коммуникативных навыков у детей с аутизмом. Сейчас проект находится на стадии прототипа.\n\nВ команду входит студент направления «Компьютерная инженерия». Проект стал победителем республиканского этапа конкурса «Мирзо Улугбек ворислари».\n\nПодробная информация опубликована в разделе «Стартапы» на официальном сайте университета.',
      '“Mehrli qadam” is a platform that helps children with autism develop social and communication skills. The project is currently at the prototype stage.\n\nThe team includes a Computer Engineering student. The project won the national round of the “Mirzo Ulugbek Vorislari” competition.\n\nMore details are published in the “Startups” section of the university’s official website.'),
    link: `${OFFICIAL}/uz/startups`,
  }),
  row3({
    title: tri('ZenithLearn: hissiy intellekt uchun sun’iy intellekt', 'ZenithLearn: искусственный интеллект для эмоционального интеллекта', 'ZenithLearn: AI for emotional intelligence'),
    date: '', category: tri('Startap', 'Стартап', 'Startup'), image: '',
    excerpt: tri('EdTech loyihasi Hult Prize tanlovining universitet bosqichida 1-o‘rinni oldi va respublika bosqichida eng kuchli 10 talikka kirdi.', 'EdTech-проект занял 1-е место на университетском этапе Hult Prize и вошёл в топ-10 республиканского этапа.', 'The EdTech project won the university round of the Hult Prize and reached the national top 10.'),
    body: tri('ZenithLearn — affective computing texnologiyasi yordamida bolalarning hissiy intellektini rivojlantirishga qaratilgan sun’iy intellekt ekotizimi.\n\nLoyiha xalqaro Hult Prize tanlovining universitet bosqichida 1-o‘rinni egalladi va respublika bosqichida eng kuchli 10 jamoa qatoriga kirdi. Hozir prototip bosqichida.',
      'ZenithLearn — экосистема искусственного интеллекта для развития эмоционального интеллекта детей с помощью технологии affective computing.\n\nПроект занял 1-е место на университетском этапе международного конкурса Hult Prize и вошёл в десятку сильнейших команд республиканского этапа. Сейчас проект на стадии прототипа.',
      'ZenithLearn is an AI ecosystem that develops children’s emotional intelligence using affective computing.\n\nThe project won the university round of the international Hult Prize and reached the top 10 teams in the national round. It is currently at the prototype stage.'),
    link: `${OFFICIAL}/uz/startups`,
  }),
  row3({
    title: tri('“Kasallikni erta aniqlash”: AI Hackathon sovrindorlari', '«Раннее выявление заболеваний»: призёры AI Hackathon', '“Early Disease Detection”: AI Hackathon prize-winners'),
    date: '', category: tri('Startap', 'Стартап', 'Startup'), image: '',
    excerpt: tri('Sun’iy intellekt asosidagi tibbiy loyiha Umummilliy AI Hackathon’da 3-o‘rinni egalladi.', 'Медицинский проект на основе ИИ занял 3-е место на Национальном AI Hackathon.', 'An AI-based healthcare project took 3rd place at the National AI Hackathon.'),
    body: tri('“Kasallikni erta aniqlash” — sun’iy intellekt yordamida kasallikni erta bosqichda aniqlashga qaratilgan loyiha.\n\nTalabalar jamoasi Umummilliy AI Hackathon’ning «Ta’lim» yo‘nalishida 3-o‘rinni qo‘lga kiritdi. Loyiha prototip bosqichida rivojlantirilmoqda.',
      '«Раннее выявление заболеваний» — проект по обнаружению болезней на ранней стадии с помощью искусственного интеллекта.\n\nКоманда студентов заняла 3-е место в направлении «Образование» на Национальном AI Hackathon. Проект развивается на стадии прототипа.',
      '“Early Disease Detection” is a project that uses artificial intelligence to detect diseases at an early stage.\n\nThe student team took 3rd place in the “Education” track at the National AI Hackathon. The project is being developed as a prototype.'),
    link: `${OFFICIAL}/uz/startups`,
  }),
];

/* ============================ GALEREYA ============================ */
const GALLERY = [
  row3({ title: tri('Kokand University kampusi', 'Кампус Kokand University', 'Kokand University campus'), category: tri('Kampus', 'Кампус', 'Campus'), image: '/img/ku/kampus.jpg', description: tri('Universitet binosi oldidagi “Founded in 2019” yozuvli toshtaxta.', 'Камень с надписью «Founded in 2019» у здания университета.', 'The “Founded in 2019” stone sign in front of the university building.'), video: '' }),
  row3({ title: tri('Umummilliy AI Hackathon: Farg‘ona', 'Национальный AI Hackathon: Фергана', 'National AI Hackathon: Fergana'), category: tri('Tadbirlar', 'События', 'Events'), image: '/img/ku/ai-hackathon.jpg', description: tri('2026-yil 20–23-may kunlari o‘tkazilgan hakatonda universitet jamoasi.', 'Команда университета на хакатоне 20–23 мая 2026 года.', 'The university team at the hackathon held on 20–23 May 2026.'), video: '' }),
  row3({ title: tri('Xalqaro hamkorlik memorandumi', 'Меморандум о международном сотрудничестве', 'International cooperation memorandum'), category: tri('Xalqaro aloqalar', 'Международные связи', 'International'), image: '/img/ku/memorandum.jpg', description: tri('Kokand University va xorijiy hamkor o‘rtasida memorandum imzolash marosimi.', 'Церемония подписания меморандума между Kokand University и зарубежным партнёром.', 'Signing ceremony of a memorandum between Kokand University and an international partner.'), video: '' }),
  row3({ title: tri('“Biznes marafon” — Farg‘ona', '«Бизнес-марафон» — Фергана', '“Business Marathon” — Fergana'), category: tri('Tadbirlar', 'События', 'Events'), image: '/img/ku/biznes-marafon.jpg', description: tri('Universitet talabalari “Biznes marafon” tadbirida.', 'Студенты университета на мероприятии «Бизнес-марафон».', 'University students at the “Business Marathon” event.'), video: '' }),
  row3({ title: tri('Xalqaro uchrashuv', 'Международная встреча', 'International visit'), category: tri('Xalqaro aloqalar', 'Международные связи', 'International'), image: '/img/ku/xalqaro-tashrif.jpg', description: tri('Universitet delegatsiyasi xorijiy hamkor universitet stendida.', 'Делегация университета у стенда зарубежного университета-партнёра.', 'The university delegation at a partner university’s stand abroad.'), video: '' }),
  row3({ title: tri('Kompyuter sinfi', 'Компьютерный класс', 'Computer lab'), category: tri('Kampus', 'Кампус', 'Campus'), image: '/img/ku/it-laboratoriya.jpg', description: tri('Zamonaviy kompyuter sinfi.', 'Современный компьютерный класс.', 'A modern computer lab.'), video: '' }),
];

/* ============================ SOZLAMALAR ============================ */
// Universitet sayti sozlamalari src/settings-defaults.js da. Bu yerda faqat
// Talabalar shaharchasi (castle profili) sahifasi uchun boshlang'ich qiymatlar.
const SETTINGS = {
  castle_title: 'Kokand University talabalar shaharchasi',
  castle_intro: 'Universitetga yaqin, xavfsiz va qulay turar joy variantlari.',
  castle_phone: '',
  castle_email: '',
  university_url: '',
};

module.exports = { PROGRAMMES, ACHIEVEMENTS, DISTINCTIONS, INTERESTS, NEWS, STORIES, GALLERY, SETTINGS };
