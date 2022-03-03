export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const mintToSymbol: { [key: string]: string } = {
  "5AvivB7ArFKWbMTnhJjBSf1HsUMgrc2jSxRxtPTDWZcW": "Mint A",
  "5UwadZgYM3U7ZTkrH5JcwR9WYuc52nw8dbhPLfRh2XQA": "Mint B",
  "59bq58XRWsbvnmnJsUfmjuY3RpaJm4uW1Yzja1tCiqkF": "Mint C",
  "3hWRzQqCn7dBPBLpANQ4EPAfR68EDpk2E7uvEMqa9o2K": "Mint D",
  FgfeF24bnbZdnM7ryv6pSK87Pc89VTgfqgDhV6GqvEKo: "BUCK",
};
