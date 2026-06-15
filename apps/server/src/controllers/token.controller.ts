import { Request, Response } from "express";
import prisma from "@repo/db";
import { createTokenSchema } from "../schemas/token.schema";

export const createToken = async (req: Request, res: Response) => {
  try {
    const parsed = createTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.flatten(),
      });
    }

    const user = req.user!;

    const existingToken = await prisma.personalToken.findUnique({
      where: {
        ownerId: user.id,
      },
    });

    if (existingToken) {
      return res.status(409).json({
        success: false,
        message: "Token already exists",
      });
    }
    const token = await prisma.personalToken.create({
      data: {
        ownerId: user.id,
        tokenName: parsed.data.tokenName,
        sysmbol: parsed.data.symbol,

        contractAddress: "0xTemporaryContractAddress",

        totalSupply: 100,
      },
    });

    await prisma.tokenHolding.create({
      data: {
        tokenId: token.id,
        holderId: user.id,
        balance: 100,
      },
    });

    return res.status(201).json({
      success: true,
      token,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const getToken = async (req: Request, res: Response) => {};

export const getTokenHolder = async (req: Request, res: Response) => {};

export const getPortfolio = async (req: Request, res: Response) => {};
