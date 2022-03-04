import Navbar from "./Navbar";
import Image from "next/image";

type Props = {
  children: JSX.Element;
};
const PageLayout = ({ children }: Props) => {
  return (
    <div className="p-4">
      {/* <Image
        src="/exp.png"
        alt="bg"
        layout="fill"
        className="layer-zero"
      /> */}
      <div className="layer-one">
        <Navbar />
        {/* mx-auto max-w-6xl */}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default PageLayout;
