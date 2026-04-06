"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/auth.store";

const LogoutButton = () => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-body text-sm font-semibold transition-all hover:scale-105 active:scale-95"
      style={{ color: "#ef4444" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#ef4444";
        e.currentTarget.style.color = "white";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = "#ef4444";
      }}
    >
      Cerrar sesión
    </button>
  );
};

export default LogoutButton;
