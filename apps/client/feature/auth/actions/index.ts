import prisma, { Account, User } from "@repo/db";

export const getUserById = async (id: string): Promise<User | null> => {
    try {
        const user = await prisma.user.findUnique({
            where: {id},
            include: {accounts: true},
        });
        return user;
    } catch(error) {
        console.log(error);
        return null;
        // throw new Error("Error while getting user by ID");
    }
}

export const getAccountByUserId = async(userId: string): Promise<Account | null> => {
    try {
        const account = await prisma.account.findFirst({
            where: {
                userId,
            }
        });
        return account;
    } catch (error) {
       console.log(error); 
       return null;
    }
}