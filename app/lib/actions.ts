'use server';


import {z, ZodError} from 'zod';
import {sql} from "@vercel/postgres";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {signIn} from "@/auth";
import {AuthError} from "next-auth";

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({id: true, date: true});
const UpdateInvoice = FormSchema.omit({id: true, date: true});
const getErrors = (errors: ZodError)=> {
    return {
        errors: errors.flatten().fieldErrors,
    };
}

export async function createInvoice(prevState: State, formData: FormData): Promise<State> {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if(validatedFields.error) {
        return getErrors(validatedFields.error)
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}


export async function updateInvoice(id: string, formData: FormData): Promise<State> {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if(validatedFields.error) {
        return getErrors(validatedFields.error)
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return {message: 'Database Error: Failed to Update Invoice.'};
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return {message: 'Deleted Invoice'};
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return {message: 'Database Error: Failed to Delete Invoice'};
    }
}


export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}
