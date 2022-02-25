import Navbar from "./Navbar";
type Props = {
  children: JSX.Element;
};
const PageLayout = ({ children }: Props) => {
  return (
    <div className="max-w-6xl py-4 mx-auto">
      <Navbar />
      <div className="container mx-auto max-w-6xl 2xl:px-0">{children}</div>
    </div>
  );
};

export default PageLayout;
