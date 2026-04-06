import { LoginPayload, LoginResponse } from "../../types/auth";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {

    console.log("AUTH REQUEST PAYLOAD:", payload);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();


  console.log("AUTH RESPONSE STATUS:", res.status);
  console.log("AUTH RESPONSE BODY:", data);


  if (!res.ok) {
    throw new Error(data.error || "Error al iniciar sesión");
  }

  return data;
}