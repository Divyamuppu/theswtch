export type Role = "team" | "client";
export type Tab = "weekly" | "socials" | "website" | "performance" | "report";
export type BoardTab = "weekly" | "socials" | "website" | "performance";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: Role;
}

export interface Settings {
  weekLabel: string;
  notes: string;
  socialsCalendarLabel: string;
  socialsCalendarUrl: string;
  websiteLabel: string;
  websiteUrl: string;
}

export interface QuickLink {
  key: "calendar" | "website" | "performance" | "report";
  label: string;
  url: string;
}

export interface Task {
  id: string;
  tab: BoardTab;
  body: string;
  done: boolean;
  url: string;
  position: number;
  createdAt: number;
}

export interface ReportLink {
  id: string;
  label: string;
  url: string;
  position: number;
}

export interface Comment {
  id: string;
  tab: Tab;
  authorId: string;
  body: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weekLabel: "",
  notes: "",
  socialsCalendarLabel: "Content Calendar (Excel)",
  socialsCalendarUrl: "",
  websiteLabel: "Website",
  websiteUrl: "",
};