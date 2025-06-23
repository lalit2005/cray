import { useState } from "react";
import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/Button";
import { useAuth } from "~/lib/auth";

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const validateForm = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};
    let isValid = true;

    if (!name) {
      newErrors.name = "Name is required";
      isValid = false;
    }

    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters long";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await signup({ name, email, password });
    } catch (error: unknown) {
      // Check if the error is about existing user
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "error" in error.response.data &&
        typeof error.response.data.error === "string" &&
        error.response.data.error.includes("already exists")
      ) {
        setErrors({ email: "This email is already registered" });
      } else {
        // The actual error message is handled by the auth context,
        // but we can set a general error state here
        setErrors({
          general:
            "Failed to create account. Please check your details and try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-zinc-900/50 p-6 rounded-lg border border-zinc-800"
      >
        <h1 className="text-2xl font-bold text-center text-zinc-100">
          Create Account
        </h1>

        {errors.general && (
          <div className="bg-red-900/30 border border-red-800 p-2 rounded text-red-100 text-sm">
            {errors.general}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="name-input" className="block text-zinc-400">
            Name
          </label>
          <input
            id="name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-3 py-2 bg-zinc-800 border ${
              errors.name ? "border-red-500" : "border-zinc-700"
            } rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600`}
            placeholder="Enter your name"
            title="Your full name"
            required
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="email-input" className="block text-zinc-400">
            Email
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-3 py-2 bg-zinc-800 border ${
              errors.email ? "border-red-500" : "border-zinc-700"
            } rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600`}
            placeholder="Enter your email"
            title="Email address for your account"
            required
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="password-input" className="block text-zinc-400">
            Password
          </label>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-3 py-2 bg-zinc-800 border ${
              errors.password ? "border-red-500" : "border-zinc-700"
            } rounded-md text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600`}
            placeholder="Create a password"
            title="Password for your account (minimum 6 characters)"
            required
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>
        <Button type="submit" disabled={loading} className="w-full py-2">
          {loading ? "Signing up..." : "Sign up"}
        </Button>
        <p className="text-center text-zinc-400 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
