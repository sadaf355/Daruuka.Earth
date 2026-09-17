import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CreateProject } from "./CreateProject";

const createProject = vi.fn();
const createSite = vi.fn();

vi.mock("../services/projects.api", () => ({
  createProject: (...args: unknown[]) => createProject(...args),
}));
vi.mock("../services/sites.api", () => ({
  createSite: (...args: unknown[]) => createSite(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateProject />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  createProject.mockReset();
  createSite.mockReset();
});

describe("CreateProject — Story 1", () => {
  it("refuses to continue without a project name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText(/give the project a name first/i)).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("sends the selected project type in the API's lowercase form", async () => {
    const user = userEvent.setup();
    createProject.mockResolvedValue({ id: "project-1" });
    renderPage();

    await user.type(screen.getByPlaceholderText(/amazon restoration/i), "Amazon Restoration");
    // "Both" also contains the word biodiversity, so anchor the match to the start.
    await user.click(screen.getByRole("button", { name: /^Biodiversity/ }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    expect(createProject.mock.calls[0][0]).toMatchObject({
      name: "Amazon Restoration",
      project_type: "biodiversity",
    });
  });

  it("advances to the polygon-drawing step once the project exists", async () => {
    const user = userEvent.setup();
    createProject.mockResolvedValue({ id: "project-1" });
    renderPage();

    await user.type(screen.getByPlaceholderText(/amazon restoration/i), "Amazon Restoration");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(/define monitoring sites/i)).toBeInTheDocument();
  });

  it("surfaces a backend failure instead of silently advancing", async () => {
    const user = userEvent.setup();
    createProject.mockRejectedValue(new Error("boom"));
    renderPage();

    await user.type(screen.getByPlaceholderText(/amazon restoration/i), "Amazon Restoration");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText(/couldn't create the project/i)).toBeInTheDocument();
    expect(screen.queryByText(/define monitoring sites/i)).not.toBeInTheDocument();
  });

  it("cannot finish the flow until at least one site is saved", async () => {
    const user = userEvent.setup();
    createProject.mockResolvedValue({ id: "project-1" });
    renderPage();

    await user.type(screen.getByPlaceholderText(/amazon restoration/i), "Amazon Restoration");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const finish = await screen.findByRole("button", { name: /save sites/i });
    expect(finish).toBeDisabled();
  });
});
