"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/auth.store";
import { Button } from "../ui/Button";

const LogoutButton = () => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <Button variant="danger-text" onClick={handleLogout} className="w-full sm:w-auto">
      Cerrar sesión
    </Button>
  );
};

export default LogoutButton;
