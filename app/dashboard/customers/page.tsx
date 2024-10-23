import {Metadata} from "next";

export const metadata: Metadata = {
    title: {
        template: '%s | Acme Customers',
        default: 'Customers',
    },
};

export default function Page() {
    return <p>Customers Page</p>;
}
