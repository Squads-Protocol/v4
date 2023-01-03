import { Permissions as IPermissions } from "./generated";

export const Permission = {
  Initiate: 0b0000_0001,
  Vote: 0b0000_0010,
  Execute: 0b0000_0100,
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

export class Permissions implements IPermissions {
  private constructor(readonly mask: number) {}

  static fromPermissions(permissions: Permission[]) {
    return new Permissions(
      permissions.reduce((mask, permission) => mask | permission, 0)
    );
  }

  static all() {
    return new Permissions(
      Object.values(Permission).reduce(
        (mask, permission) => mask | permission,
        0
      )
    );
  }
}
