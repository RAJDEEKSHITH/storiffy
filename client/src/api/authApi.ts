import axios from "./axios";
import type { User } from "../types/user";

interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: "user" | "manager" | "admin";
    };
  };
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
  };
}

interface CurrentUserResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
  };
}

export const registerUser = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}): Promise<void> => {
  await axios.post<RegisterResponse>("/auth/register", {
    name,
    email,
    password,
  });
};

export const loginUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<User> => {
  const response = await axios.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  return response.data.data.user;
};

export const getCurrentUser = async (): Promise<User> => {
  const response = await axios.get<CurrentUserResponse>("/auth/user");
  return response.data.data.user;
};

export const logoutUser = async (): Promise<void> => {
  await axios.post("/auth/logout");
};

export const logoutAllUsers = async (): Promise<void> => {
  await axios.post("/auth/logout-all");
};