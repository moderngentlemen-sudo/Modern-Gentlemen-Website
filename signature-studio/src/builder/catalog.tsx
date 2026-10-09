import type { ReactNode } from "react";
import {
  AlignVerticalSpaceAround,
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  Columns2,
  Columns3,
  CreditCard,
  Image as ImageIcon,
  LayoutPanelTop,
  Minus,
  MousePointerClick,
  PenLine,
  Play,
  QrCode,
  Quote,
  ScrollText,
  Share2,
  Smartphone,
  Star,
  Type,
  User,
  UserRound,
  Briefcase,
} from "lucide-react";
import { block, col, panel, rowOf } from "../core/blocks";
import type { Block, BlockType } from "../core/types";

export interface CatalogItem {
  id: string;
  label: string;
  hint: string;
  group: "Layout" | "You" | "Content" | "Promote";
  icon: ReactNode;
  create: () => Block;
}

const I = 18;

export const CATALOG: CatalogItem[] = [
  { id: "cols2", group: "Layout", label: "2 columns", hint: "Side by side", icon: <Columns2 size={I} />, create: () => rowOf([col(), col()]) },
  { id: "cols3", group: "Layout", label: "3 columns", hint: "Three across", icon: <Columns3 size={I} />, create: () => rowOf([col(), col(), col()]) },
  {
    id: "panel",
    group: "Layout",
    label: "Panel",
    hint: "A coloured box to group blocks",
    icon: <LayoutPanelTop size={I} />,
    create: () => panel([], { background: "#f3f1fb", padding: 16, radius: 12 }, 6),
  },
  { id: "divider", group: "Layout", label: "Divider", hint: "A thin line", icon: <Minus size={I} />, create: () => block("divider") },
  { id: "spacer", group: "Layout", label: "Space", hint: "Breathing room", icon: <AlignVerticalSpaceAround size={I} />, create: () => block("spacer") },

  { id: "name", group: "You", label: "Name", hint: "Your full name", icon: <User size={I} />, create: () => block("name") },
  { id: "title", group: "You", label: "Job title", hint: "Title · company", icon: <Briefcase size={I} />, create: () => block("title") },
  {
    id: "company",
    group: "You",
    label: "Company",
    hint: "Company name",
    icon: <Building2 size={I} />,
    create: () => block("field", { field: "company", upper: true }),
  },
  { id: "contacts", group: "You", label: "Contacts", hint: "Phone, email, web", icon: <AtSign size={I} />, create: () => block("contacts") },
  { id: "socials", group: "You", label: "Social icons", hint: "Your profiles", icon: <Share2 size={I} />, create: () => block("socials") },
  { id: "photo", group: "You", label: "Photo", hint: "Your headshot", icon: <UserRound size={I} />, create: () => block("photo") },
  { id: "logo", group: "You", label: "Logo", hint: "Company logo", icon: <BadgeCheck size={I} />, create: () => block("logo") },
  {
    id: "monogram",
    group: "You",
    label: "Monogram",
    hint: "Your initials",
    icon: <span style={{ fontWeight: 800, fontSize: 13 }}>JE</span>,
    create: () => block("monogram"),
  },

  { id: "text", group: "Content", label: "Text", hint: "Any words", icon: <Type size={I} />, create: () => block("text") },
  { id: "image", group: "Content", label: "Image", hint: "Banner or graphic", icon: <ImageIcon size={I} />, create: () => block("image") },
  { id: "signOff", group: "Content", label: "Sign-off", hint: "“Best regards,”", icon: <PenLine size={I} />, create: () => block("signOff") },
  { id: "quote", group: "Content", label: "Quote", hint: "A favourite line", icon: <Quote size={I} />, create: () => block("quote") },
  {
    id: "disclaimer",
    group: "Content",
    label: "Disclaimer",
    hint: "Small print",
    icon: <ScrollText size={I} />,
    create: () => block("text", { text: "This email and any attachments are confidential and intended solely for the addressee.", size: 10, muted: true }),
  },

  { id: "button", group: "Promote", label: "Button", hint: "Call to action", icon: <MousePointerClick size={I} />, create: () => block("button") },
  {
    id: "meeting",
    group: "Promote",
    label: "Book a meeting",
    hint: "Calendly, Cal.com…",
    icon: <CalendarDays size={I} />,
    create: () => block("button", { text: "Book a meeting", buttonStyle: "outline", icon: "calendar" }),
  },
  { id: "reviews", group: "Promote", label: "Star rating", hint: "Reviews link", icon: <Star size={I} />, create: () => block("reviews") },
  { id: "video", group: "Promote", label: "Video", hint: "Thumbnail + play", icon: <Play size={I} />, create: () => block("video") },
  { id: "apps", group: "Promote", label: "App badges", hint: "App Store, Google Play", icon: <Smartphone size={I} />, create: () => block("apps") },
  { id: "canva", group: "Promote", label: "Canva design", hint: "Your card or design", icon: <CreditCard size={I} />, create: () => block("canva") },
  { id: "digitalCard", group: "Promote", label: "Digital card", hint: "QR + link", icon: <QrCode size={I} />, create: () => block("digitalCard") },
];

const LABELS: Record<BlockType, string> = {
  row: "Columns",
  name: "Name",
  title: "Job title",
  field: "Detail",
  text: "Text",
  contacts: "Contacts",
  socials: "Social icons",
  photo: "Photo",
  logo: "Logo",
  image: "Image",
  monogram: "Monogram",
  divider: "Divider",
  spacer: "Space",
  button: "Button",
  signOff: "Sign-off",
  quote: "Quote",
  reviews: "Star rating",
  video: "Video",
  apps: "App badges",
  digitalCard: "Digital card",
  canva: "Canva design",
};

export function blockLabel(b: Block): string {
  switch (b.type) {
    case "row":
      return b.columns.length === 1 ? "Panel" : `${b.columns.length} columns`;
    case "field":
      return b.field[0].toUpperCase() + b.field.slice(1);
    case "text":
      return b.text.trim() ? `“${b.text.trim().slice(0, 24)}${b.text.trim().length > 24 ? "…" : ""}”` : "Text";
    case "button":
      return `Button · ${b.text || "…"}`;
    default:
      return LABELS[b.type];
  }
}
