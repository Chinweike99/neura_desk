import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';


@Injectable()
export class AuthService {

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ){}

    async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

        if(user && await argon2.verify(user.password, password)){
            const {password, ...result} = user;
            return result;
        }
        return null;
    }

    async login(user: User){
        const payload = { sub: user.id, email: user.email };
        return {
            access_token: this.jwtService.sign(payload),
            user:{
                id: user.id,
                email: user.email,
                name: user.name
            }
        };
    }

    async register(email: string, name: string, password: string){
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if(existingUser){
            throw new UnauthorizedException('User with this email already exists');
        }

        const hashedPassword = await argon2.hash(password);
        const newUser = await this.prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword
            }
        });

        const { password: _, ...result } = newUser;
        return result;
    }



}