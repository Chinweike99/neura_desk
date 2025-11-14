// import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// export const GetUser = createParamDecorator(
//   (data: string | undefined, ctx: ExecutionContext) => {
//     const request = ctx.switchToHttp().getRequest();
//     const user = request.user;

//     if (!user) {
//       throw new Error('User not found in request');
//     }

//     return data ? user?.[data] : user;
//   },
// );

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Define your user interface
export interface JwtUser {
  id: string;
  email: string;
  // Add other properties as needed
}

// Define a custom request interface
interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

export const GetUser = createParamDecorator(
  (
    data: keyof JwtUser | undefined,
    ctx: ExecutionContext,
  ): JwtUser | string | number | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new Error(
        'User not found in request. Make sure AuthGuard is applied.',
      );
    }

    if (data) {
      const value = user[data];
      if (value === undefined) {
        throw new Error(`User property '${data}' not found`);
      }
      return value;
    }

    return user;
  },
);
