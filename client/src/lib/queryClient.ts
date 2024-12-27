import { QueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Ensure global is defined for Node.js modules
if (typeof global === 'undefined') {
  (window as any).global = window;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 401) {
              throw new Error("Please log in to continue");
            }
            if (res.status >= 500) {
              throw new Error("Server error. Please try again later.");
            }
            throw new Error(errorText || res.statusText);
          }

          return res.json();
        } catch (error: any) {
          throw error;
        }
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});