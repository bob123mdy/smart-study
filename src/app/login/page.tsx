import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-12">
      <AuthForm mode="login" />
    </div>
  );
}
