const imgPre =
  "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,f_webp,h_75/teams/"

export interface Team {
  id: string
  name: string
  logo: string
  logoDark?: string
}

export const ID_TEAMS: Team[] = [
  {
    id: "TLID",
    name: "Team Liquid ID",
    logo: `${imgPre}liquid_lightmode`,
    logoDark: `${imgPre}liquid_darkmode`,
  },
  {
    id: "ONIC",
    name: "ONIC Esports",
    logo: `${imgPre}onic_lightmode`,
    logoDark: `${imgPre}onic`,
  },
  {
    id: "DEWA",
    name: "Dewa United Esports",
    logo: `${imgPre}dewa`
  },
  {
    id: "AE",
    name: "Alter Ego Esports",
    logo: `${imgPre}ae`,
  },
  {
    id: "BTR",
    name: "Bigetron by Vitality",
    logo: `${imgPre}btrvit`,
    logoDark: `${imgPre}btrvit_darkmode`,
  },
  {
    id: "EVOS",
    name: "EVOS Esports",
    logo: `${imgPre}evos`,
  },
  {
    id: "NAVI",
    name: "Natus Vincere",
    logo: `${imgPre}navi_lightmode`,
    logoDark: `${imgPre}navi_darkmode`,
  },
  {
    id: "GEEK",
    name: "Geek Fam ID",
    logo: `${imgPre}geek`,
  },
  {
    id: "RRQ",
    name: "RRQ Hoshi",
    logo: "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,f_webp,h_75,w_97,c_pad/teams/rrq",
  },
]

export const PH_TEAMS: Team[] = [
  {
    id: "APBR",
    name: "AP.Bren",
    logo: `${imgPre}apbren`,
  },
  {
    id: "RORA",
    name: "Aurora Gaming PH",
    logo: `${imgPre}aurora`,
  },
  {
    id: "FLCN",
    name: "Team Falcons PH",
    logo: `${imgPre}falcons`,
  },
  {
    id: "ONIC",
    name: "ONIC Philippines",
    logo: `${imgPre}onph_lightmode`,
    logoDark: `${imgPre}onph`,
  },
  {
    id: "OMG",
    name: "Smart Omega",
    logo: `${imgPre}omega_lightmode`,
    logoDark: `${imgPre}omega_darkmode`,
  },
  {
    id: "TLPH",
    name: "Team Liquid PH",
    logo: `${imgPre}liquid_lightmode`,
    logoDark: `${imgPre}liquid_darkmode`,
  },
  {
    id: "TWIS",
    name: "Twisted Minds PH",
    logo: "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,f_webp,h_75,w_93,c_pad/teams/twisted",
  },
  {
    id: "TNC",
    name: "TNC Pro Team",
    logo: `${imgPre}tnc`,
  },
]

export const MY_TEAMS: Team[] = [
  {
    id: "AC",
    name: "AC Esports",
    logo: `${imgPre}ac`,
  },
  {
    id: "BTRM",
    name: "Bigetron MY by VIT",
    logo: `${imgPre}btrvit`,
    logoDark: `${imgPre}btrvit_darkmode`,
  },
  {
    id: "iG",
    name: "Invictus Gaming",
    logo: `${imgPre}invictus`,
    logoDark:
      "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,f_webp,h_75,e_negate/teams/invictus",
  },
  {
    id: "TR",
    name: "Team Rey",
    logo: `${imgPre}tr`,
  },
  {
    id: "VMS",
    name: "Team Vamos",
    logo: `${imgPre}vamos_lightmode`,
    logoDark: `${imgPre}vamos_darkmode`,
  },
  {
    id: "RRQ",
    name: "RRQ Tora",
    logo: "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,f_webp,h_75,w_97,c_pad/teams/rrq",
  },
  {
    id: "SRG",
    name: "Selangor Red Giant",
    logo: `${imgPre}srg`,
  },
  {
    id: "FL",
    name: "Team Flash",
    logo: `${imgPre}flash`,
  },
]
