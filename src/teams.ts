const imgPre =
  "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,h_60/teams/"

export interface Team {
  id: string
  name: string
  logo: string
  logoDark?: string
}

export const TEAMS: Team[] = [
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
    logo: "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,h_60,w_82,c_pad/teams/dewa",
    logoDark:
      "https://mpl.isan.eu.org/cdn-cgi/image/f=webp/https://res.cloudinary.com/isans/image/upload/q_auto:eco,h_60,w_84,c_pad/teams/dewa_darkmode",
  },
  { id: "AE", name: "Alter Ego Esports", logo: `${imgPre}ae` },
  {
    id: "BTR",
    name: "Bigetron by Vitality",
    logo: `${imgPre}btrvit`,
    logoDark: `${imgPre}btrvit_darkmode`,
  },
  { id: "EVOS", name: "EVOS Esports", logo: `${imgPre}evos` },
  {
    id: "NAVI",
    name: "Natus Vincere",
    logo: `${imgPre}navi_lightmode`,
    logoDark: `${imgPre}navi_darkmode`,
  },
  { id: "GEEK", name: "Geek Fam ID", logo: `${imgPre}geek` },
  { id: "RRQ", name: "RRQ Hoshi", logo: `${imgPre}rrq` },
]
