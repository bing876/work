import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "./CreateProjectDialog";

describe("CreateProjectDialog", () => {
  it("closes from close and cancel controls", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <CreateProjectDialog onClose={onClose} onCreate={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "关闭创建项目" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <CreateProjectDialog onClose={onClose} onCreate={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps v0.32 avatar, switch, folder, and attachment state", async () => {
    render(
      <CreateProjectDialog onClose={vi.fn()} onCreate={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(document.querySelector(".project-avatar-plus")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("项目名称"), { target: { value: "发布项目" } });
    expect(screen.getByLabelText("项目名称")).toHaveValue("发布项目");
    fireEvent.click(screen.getByRole("button", { name: "切换模板配置" }));
    fireEvent.click(screen.getByRole("button", { name: "切换行业数据" }));
    expect(screen.getByRole("button", { name: "切换模板配置" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "切换行业数据" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.change(screen.getByLabelText("头像输入"), {
      target: { files: [new File(["avatar"], "avatar.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("button", { name: "删除项目头像" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除项目头像" }));
    expect(screen.queryByRole("button", { name: "删除项目头像" })).not.toBeInTheDocument();
    expect(document.querySelector(".project-avatar-plus")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("工作文件夹输入"), {
      target: { files: [new File(["x"], "DemoFolder", { type: "text/plain" })] },
    });
    expect(screen.getByTestId("working-folder-status")).toHaveTextContent("DemoFolder");
    expect(screen.getByTestId("attachment-DemoFolder")).toHaveAttribute(
      "data-attachment-kind",
      "folder",
    );
    fireEvent.click(screen.getByTestId("attachment-DemoFolder"));
    expect(screen.getByTestId("working-folder-status")).toHaveTextContent("DemoFolder");
    fireEvent.click(screen.getByRole("button", { name: "移除附件 DemoFolder" }));
    expect(screen.getByTestId("working-folder-status")).toHaveTextContent("未添加源文件");
    expect(screen.getByLabelText("项目名称")).toHaveValue("发布项目");
    fireEvent.drop(screen.getByLabelText("项目需求").parentElement!, {
      dataTransfer: { items: [], files: [new File(["x"], "brief.md", { type: "text/markdown" })] },
    });
    expect(screen.getByRole("button", { name: "移除附件 brief.md" })).toBeInTheDocument();
    expect(screen.getByTestId("attachment-brief.md")).toHaveAttribute(
      "data-attachment-kind",
      "file",
    );
  });

  it("shows drag feedback and distinguishes image attachments", () => {
    render(
      <CreateProjectDialog onClose={vi.fn()} onCreate={vi.fn().mockResolvedValue(undefined)} />,
    );
    const composer = screen.getByLabelText("项目需求").parentElement!;
    fireEvent.dragEnter(composer);
    expect(composer).toHaveClass("drag");
    fireEvent.dragLeave(composer);
    expect(composer).not.toHaveClass("drag");
    fireEvent.drop(composer, {
      dataTransfer: { items: [], files: [new File(["image"], "cover.png", { type: "image/png" })] },
    });
    expect(screen.getByTestId("attachment-cover.png")).toHaveAttribute(
      "data-attachment-kind",
      "image",
    );
  });

  it("submits the unified project payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProjectDialog onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("项目名称"), { target: { value: "项目 Agent" } });
    fireEvent.change(screen.getByLabelText("项目需求"), { target: { value: "执行项目目标" } });
    fireEvent.click(screen.getByRole("button", { name: "切换模板配置" }));
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "项目 Agent",
          workingFolder: null,
          initialMessage: "执行项目目标",
          templateEnabled: true,
          industryIntelligenceEnabled: true,
        }),
      ),
    );
    expect(onCreate.mock.calls[0]?.[0]).not.toHaveProperty("avatar");
  });

  it("uses an uploaded avatar as the Project.avatar value", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateProjectDialog onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText("头像输入"), {
      target: { files: [new File(["avatar"], "avatar.png", { type: "image/png" })] },
    });
    await screen.findByRole("button", { name: "删除项目头像" });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar: expect.objectContaining({
            source: "upload",
            name: "avatar.png",
            dataUrl: expect.stringContaining("data:image/png;base64,"),
          }),
        }),
      ),
    );
  });
});
