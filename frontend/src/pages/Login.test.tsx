import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

// A plain wrapper (not the spy itself) keeps the spy's promise tracking out of the rejection path.
let behavior: (email: string, password: string) => Promise<void> = async () => undefined;
const login = vi.fn((email: string, password: string) => behavior(email, password));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ login: (e: string, p: string) => login(e, p) }) }));

const setup = () => render(<MemoryRouter><Login /></MemoryRouter>);

describe("Login form", () => {
  beforeEach(() => { login.mockClear(); behavior = async () => undefined; });

  it("blocks submission with an invalid email", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "whatever1");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(login).not.toHaveBeenCalled();
  });

  it("submits valid credentials", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.io");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(login).toHaveBeenCalledWith("a@b.io", "password123");
  });

  it("shows a friendly error when login fails", async () => {
    behavior = () => Promise.reject(new Error("boom"));
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.io");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});
