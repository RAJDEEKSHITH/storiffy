import axios from "axios";
import { store } from "../store/store";
import { clearUser } from "../store/auth/authSlice";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string;

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      store.dispatch(clearUser());
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
