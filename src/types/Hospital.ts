export type Hospital = {
  id: string,
  hospitalName: string,
  address: {
    street: string,
    city: string,
    state: string,
    zipcode: number,
    country: string,
  }
}