import { Radar } from "lucide-react";

export function SharedFooter() {
  return (
    <footer className="relative z-10 border-t border-[#DDE8F6] bg-white/76 px-5 py-10 backdrop-blur md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-sm text-[#8BA1C8] md:flex-row">
        <a href="/" className="flex items-center gap-2 font-extrabold text-[#043873]">
          <span className="grid size-7 place-items-center rounded-md bg-[#043873] text-white">
            <Radar size={16} aria-hidden="true" />
          </span>
          RoleGuage
        </a>
        <div className="flex flex-wrap justify-center gap-6">
          <a href="#" className="hover:text-[#043873]">Privacy</a>
          <a href="#" className="hover:text-[#043873]">Terms</a>
          <a href="#" className="hover:text-[#043873]">Contact</a>
          <a href="#" className="hover:text-[#043873]">Blog</a>
        </div>
        <p>© 2026 RoleGuage. All rights reserved.</p>
      </div>
    </footer>
  );
}
