import type { NextPage } from "next";
import Head from "next/head";
import PageLayout from "../components/Layout/PageLayout";
import Home from "../views/Home";

const Index: NextPage = (props) => {
  return (
    <div>
     
      <Head>
        <title>Bucket DAO</title>
        <meta name="description" content="This site will fly high 🦤" />
      </Head>
      <PageLayout>
        <Home />
      </PageLayout>
    </div>
  );
};

export default Index;
