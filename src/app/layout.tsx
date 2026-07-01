import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RoleGuage | Resume Job Match Checker",
  description:
    "Upload a resume, import a job ad, get a fit score, evidence gaps, resume bullet guidance, interview prep, and a cover letter draft.",
  keywords: [
    "resume job match checker",
    "job application helper",
    "resume tailoring",
    "cover letter generator",
    "ATS resume checker",
  ],
  openGraph: {
    title: "RoleGuage",
    description:
      "Check resume fit, find evidence gaps, and build a clearer application plan before you apply.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
