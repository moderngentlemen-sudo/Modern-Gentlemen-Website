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
  Award,
  BriefcaseBusiness,
  Clock,
  ListChecks,
  Megaphone,
  MessageSquareQuote,
  Rows3,
  ScanQrCode,
  Tag,
  Ticket,
} from "lucide-react";
import { block, col, panel, rowOf } from "../core/blocks";
import type { Block, BlockType } from "../core/types";

export interface CatalogItem {
  id: string;
  label: string;
  hint: string;
  group: "Layout" | "You" | "Content" | "Promote" | "Ready-made";
  icon: ReactNode;
  create: () => Block;
}

const I = 18;

const READY: CatalogItem[] = [
  {
    id: "promo",
    group: "Ready-made",
    label: "Promo card",
    hint: "Headline, line and a button in a panel",
    icon: <Megaphone size={I} />,
    create: () =>
      panel(
        [
          block("text", { text: "Spring offer — 20% off", bold: true, size: 15 }),
          block("text", { text: "For new clients until May 31.", muted: true }),
          block("button", { text: "Book now", buttonStyle: "pill" }),
        ],
        { background: "#fff0ea", padding: 16, radius: 12 },
        6,
      ),
  },
  {
    id: "event",
    group: "Ready-made",
    label: "Event",
    hint: "Date, title and tickets",
    icon: <Ticket size={I} />,
    create: () =>
      panel(
        [
          block("tag", { text: "Upcoming event", filled: true }),
          block("text", { text: "Design Week Toronto", bold: true, size: 15 }),
          block("iconText", { icon: "calendar", text: "May 14–16 · Booth 21" }),
          block("button", { text: "Get tickets", buttonStyle: "outline" }),
        ],
        { background: "#f3f1fb", padding: 16, radius: 12 },
        6,
      ),
  },
  {
    id: "testimonial",
    group: "Ready-made",
    label: "Testimonial",
    hint: "A client quote in a panel",
    icon: <MessageSquareQuote size={I} />,
    create: () =>
      panel(
        [block("quote", { text: "The best decision we made this year.", author: "A happy client" })],
        { background: "#f6f4ef", padding: 14, radius: 10 },
        4,
      ),
  },
  {
    id: "hours",
    group: "Ready-made",
    label: "Office hours",
    hint: "When you're available",
    icon: <Clock size={I} />,
    create: () => block("iconText", { icon: "clock", text: "Mon–Fri, 9am–5pm" }),
  },
  {
    id: "hiring",
    group: "Ready-made",
    label: "We're hiring",
    hint: "A tag linking to your jobs page",
    icon: <BriefcaseBusiness size={I} />,
    create: () => block("tag", { text: "We're hiring →", filled: true }),
  },
  {
    id: "contactIcons",
    group: "Ready-made",
    label: "Contact row",
    hint: "Three icon lines side by side",
    icon: <Rows3 size={I} />,
    create: () =>
      rowOf(
        [
          col([block("iconText", { icon: "phone", text: "Call me" })]),
          col([block("iconText", { icon: "email", text: "Email me" })]),
          col([block("iconText", { icon: "calendar", text: "Book a call" })]),
        ],
        { gap: 14, valign: "middle" },
      ),
  },
];

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
  { id: "tag", group: "Content", label: "Tag", hint: "A small badge", icon: <Tag size={I} />, create: () => block("tag") },
  { id: "iconText", group: "Content", label: "Icon line", hint: "Any text with an icon", icon: <ListChecks size={I} />, create: () => block("iconText") },
  { id: "logos", group: "Promote", label: "Logo row", hint: "Awards, partners, press", icon: <Award size={I} />, create: () => block("logos") },
  { id: "qr", group: "Promote", label: "QR code", hint: "Website, card or any link", icon: <ScanQrCode size={I} />, create: () => block("qr") },
  { id: "canva", group: "Promote", label: "Canva design", hint: "Your card or design", icon: <CreditCard size={I} />, create: () => block("canva") },
  { id: "digitalCard", group: "Promote", label: "Digital card", hint: "QR + link", icon: <QrCode size={I} />, create: () => block("digitalCard") },
  ...READY,
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
  logos: "Logo row",
  qr: "QR code",
  iconText: "Icon line",
  tag: "Tag",
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
    case "tag":
      return `Tag · ${b.text || "…"}`;
    case "iconText":
      return b.text.trim() || "Icon line";
    default:
      return LABELS[b.type];
  }
}
