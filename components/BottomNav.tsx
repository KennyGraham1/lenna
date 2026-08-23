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
        >
          <span>{item.icon}</span>
          <label>{item.label}</label>
        </Link>
      ))}
    </nav>
  );
}
