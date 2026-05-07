import { AuthController } from "./auth.controller";
import { ForbiddenException } from "@nestjs/common";

describe("AuthController", () => {
  it("does not return refreshToken in login body", async () => {
    const controller = new AuthController({
      login: jest.fn().mockResolvedValue({
        accessToken: "access",
        refreshToken: "refresh",
        user: { id: "1", email: "admin@test.com", role: "ADMIN", name: "Admin" }
      })
    } as never);
    const response = { cookie: jest.fn() } as never;

    const result = await controller.login({ email: "admin@test.com", password: "Password1" }, response);

    expect(result).toEqual({ user: { id: "1", email: "admin@test.com", role: "ADMIN", name: "Admin" } });
    expect(JSON.stringify(result)).not.toContain("refresh");
  });

  it("returns a clear error when refreshToken cookie is missing", async () => {
    const refresh = jest.fn();
    const controller = new AuthController({ refresh } as never);
    const response = { cookie: jest.fn() } as never;

    await expect(controller.refresh({ cookies: {} } as never, response)).rejects.toThrow(
      new ForbiddenException("Refresh token ausente")
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
