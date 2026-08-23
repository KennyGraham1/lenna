"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/log", icon: "💧", label: "Log" },
  { href: "/shop", icon: "🛒", label: "Shop" },
  { href: "/garden", icon: "🌿", label: "Garden" },
  { href: "/profile", icon: "👤", label: "Profile" }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn ${pathname === item.href ? "active" : ""}`}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
