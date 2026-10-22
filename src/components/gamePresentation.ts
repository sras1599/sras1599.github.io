import type { ImageMetadata } from "astro";
import type { GameId } from "../data/games/contracts";

import bracketCityLogo from "../assets/bracket-city-logo.avif";
import connectionsLogo from "../assets/connections-logo.png";
import miniLogo from "../assets/mini-logo.png";
import taglineIcon from "../assets/tagline-icon.webp";

type CardPresentation = {
  title: string;
  icon: ImageMetadata;
  playLink: {
    label: string;
    href: string;
  };
  cardClass: string;
  calendarClass: string;
};

export const gamePresentation: Record<GameId, CardPresentation> = {
  "connections": {
    title: "Connections",
    icon: connectionsLogo,
    playLink: {
      label: "Play on NYT Games",
      href: "https://www.nytimes.com/games/connections",
    },
    cardClass: "connections-card",
    calendarClass: "connections-calendar",
  },
  "mini": {
    title: "Mini",
    icon: miniLogo,
    playLink: {
      label: "Play on NYT Games",
      href: "https://www.nytimes.com/crosswords/game/mini",
    },
    cardClass: "mini-card",
    calendarClass: "value-calendar",
  },
  "bracket-city": {
    title: "Bracket City",
    icon: bracketCityLogo,
    playLink: {
      label: "Play on The Atlantic",
      href: "https://www.theatlantic.com/games/bracket-city/",
    },
    cardClass: "bracket-card",
    calendarClass: "value-calendar",
  },
  "tagline": {
    title: "Tagline",
    icon: taglineIcon,
    playLink: {
      label: "Play on Merriam Webster",
      href: "https://www.merriam-webster.com/games/tagline",
    },
    cardClass: "tagline-card",
    calendarClass: "tagline-calendar",
  },
};
